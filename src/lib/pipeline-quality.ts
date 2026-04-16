import { db } from "@/lib/db";
import { rawClaims, rawPharmacy } from "@/lib/schema";

const VALID_ICD_CODES = new Set([
  "E11.9",
  "I50.9",
  "J44.1",
  "I10",
  "N18.9",
  "J45.909",
  "F32.9",
  "Z00.0",
]);

const ICD_CORRECTIONS: Record<string, string> = {
  E119: "E11.9",
  I509: "I50.9",
  J441: "J44.1",
  I1O: "I10",
  N189: "N18.9",
  "j45.909": "J45.909",
  F329: "F32.9",
  E11: "E11.9",
  I50: "I50.9",
};

const VALID_DRUGS = new Set([
  "Metformin",
  "Ozempic",
  "Jardiance",
  "Lisinopril",
  "Atorvastatin",
  "Losartan",
  "Albuterol",
  "Symbicort",
  "Sertraline",
  "Buspirone",
  "Amlodipine",
  "Omeprazole",
  "Insulin Glargine",
  "Furosemide",
]);

const DRUG_CORRECTIONS: Record<string, string> = {
  metformin: "Metformin",
  OZEMPIC: "Ozempic",
  jardiance: "Jardiance",
  Lisinoprl: "Lisinopril",
  atorvastatin: "Atorvastatin",
  "losartan HCL": "Losartan",
  "albuterol sulfate": "Albuterol",
  Symbicrt: "Symbicort",
  sertralin: "Sertraline",
};

type SourceSnapshot = {
  totalRecords: number;
  cleanRecords: number;
  correctedRecords: number;
  quarantinedRecords: number;
  beforeScore: number;
  afterScore: number;
  improvement: number;
};

export type PipelineIssueSummary = {
  key: string;
  label: string;
  found: number;
  autoFixed: number;
  quarantined: number;
};

export type PipelineQualitySnapshot = {
  beforeScore: number;
  afterScore: number;
  improvement: number;
  totalRecords: number;
  cleanRecords: number;
  correctedRecords: number;
  quarantinedRecords: number;
  retainedRecords: number;
  issueSummary: {
    totalFlags: number;
    autoFixed: number;
    quarantined: number;
    topIssues: PipelineIssueSummary[];
  };
  sources: {
    rawClaims: SourceSnapshot;
    rawPharmacy: SourceSnapshot;
  };
};

function roundScore(value: number) {
  return Math.round(value * 10) / 10;
}

function summarizeSource(total: number, clean: number, corrected: number, quarantined: number): SourceSnapshot {
  if (total === 0) {
    return {
      totalRecords: 0,
      cleanRecords: 0,
      correctedRecords: 0,
      quarantinedRecords: 0,
      beforeScore: 0,
      afterScore: 0,
      improvement: 0,
    };
  }

  const beforeScore = roundScore(((clean + corrected * 0.4) / total) * 100);
  const afterScore = roundScore(((clean + corrected) / total) * 100);

  return {
    totalRecords: total,
    cleanRecords: clean,
    correctedRecords: corrected,
    quarantinedRecords: quarantined,
    beforeScore,
    afterScore,
    improvement: roundScore(afterScore - beforeScore),
  };
}

function createIssueAccumulator() {
  const issues = new Map<string, PipelineIssueSummary>();

  function recordIssue(
    key: string,
    label: string,
    resolution: "autoFixed" | "quarantined"
  ) {
    const existing = issues.get(key) ?? {
      key,
      label,
      found: 0,
      autoFixed: 0,
      quarantined: 0,
    };

    existing.found += 1;
    if (resolution === "autoFixed") {
      existing.autoFixed += 1;
    } else {
      existing.quarantined += 1;
    }

    issues.set(key, existing);
  }

  return {
    recordIssue,
    summarize() {
      const topIssues = [...issues.values()].sort((a, b) => b.found - a.found);

      return {
        totalFlags: topIssues.reduce((sum, issue) => sum + issue.found, 0),
        autoFixed: topIssues.reduce((sum, issue) => sum + issue.autoFixed, 0),
        quarantined: topIssues.reduce((sum, issue) => sum + issue.quarantined, 0),
        topIssues,
      };
    },
  };
}

export async function getPipelineQualitySnapshot(): Promise<PipelineQualitySnapshot> {
  const [claimRows, pharmacyRows] = await Promise.all([
    db.select().from(rawClaims),
    db.select().from(rawPharmacy),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const issueAccumulator = createIssueAccumulator();

  let cleanClaims = 0;
  let correctedClaims = 0;
  let quarantinedClaims = 0;

  for (const row of claimRows) {
    const invalidMember = !row.memberId || row.memberId.startsWith("M-ORPHAN");
    const invalidAmount = row.amount < 0 || row.amount > 100000;
    const invalidDate = !row.date || row.date > today;

    if (invalidMember) {
      issueAccumulator.recordIssue(
        "member-integrity",
        "Missing or orphan member IDs",
        "quarantined"
      );
    }
    if (invalidAmount) {
      issueAccumulator.recordIssue(
        "range-anomalies",
        "Out-of-range numeric values",
        "quarantined"
      );
    }
    if (invalidDate) {
      issueAccumulator.recordIssue(
        "date-quality",
        "Missing or future-dated records",
        "quarantined"
      );
    }

    let hasFixableCorrection = false;
    let invalidIcd = false;

    if (!row.icdCode) {
      invalidIcd = true;
      issueAccumulator.recordIssue(
        "unknown-values",
        "Unknown or unusable clinical values",
        "quarantined"
      );
    } else if (!VALID_ICD_CODES.has(row.icdCode)) {
      hasFixableCorrection = Boolean(ICD_CORRECTIONS[row.icdCode]);
      invalidIcd = !hasFixableCorrection;
      issueAccumulator.recordIssue(
        hasFixableCorrection ? "normalization" : "unknown-values",
        hasFixableCorrection
          ? "Code and name normalization needed"
          : "Unknown or unusable clinical values",
        hasFixableCorrection ? "autoFixed" : "quarantined"
      );
    }

    if (invalidMember || invalidAmount || invalidDate || invalidIcd) {
      quarantinedClaims++;
      continue;
    }

    if (hasFixableCorrection) {
      correctedClaims++;
    } else {
      cleanClaims++;
    }
  }

  let cleanPharmacy = 0;
  let correctedPharmacy = 0;
  let quarantinedPharmacy = 0;

  for (const row of pharmacyRows) {
    const invalidMember = !row.memberId || row.memberId.startsWith("M-ORPHAN");
    const invalidAdherence = row.adherencePct < 0 || row.adherencePct > 100;
    const invalidFillDate = !row.fillDate;

    if (invalidMember) {
      issueAccumulator.recordIssue(
        "member-integrity",
        "Missing or orphan member IDs",
        "quarantined"
      );
    }
    if (invalidAdherence) {
      issueAccumulator.recordIssue(
        "range-anomalies",
        "Out-of-range numeric values",
        "quarantined"
      );
    }
    if (invalidFillDate) {
      issueAccumulator.recordIssue(
        "date-quality",
        "Missing or future-dated records",
        "quarantined"
      );
    }

    let hasFixableCorrection = false;
    let invalidDrug = false;

    if (!row.drugName) {
      invalidDrug = true;
      issueAccumulator.recordIssue(
        "unknown-values",
        "Unknown or unusable clinical values",
        "quarantined"
      );
    } else if (!VALID_DRUGS.has(row.drugName)) {
      hasFixableCorrection = Boolean(DRUG_CORRECTIONS[row.drugName]);
      invalidDrug = !hasFixableCorrection;
      issueAccumulator.recordIssue(
        hasFixableCorrection ? "normalization" : "unknown-values",
        hasFixableCorrection
          ? "Code and name normalization needed"
          : "Unknown or unusable clinical values",
        hasFixableCorrection ? "autoFixed" : "quarantined"
      );
    }

    if (invalidMember || invalidAdherence || invalidFillDate || invalidDrug) {
      quarantinedPharmacy++;
      continue;
    }

    if (hasFixableCorrection) {
      correctedPharmacy++;
    } else {
      cleanPharmacy++;
    }
  }

  const claimSnapshot = summarizeSource(
    claimRows.length,
    cleanClaims,
    correctedClaims,
    quarantinedClaims
  );
  const pharmacySnapshot = summarizeSource(
    pharmacyRows.length,
    cleanPharmacy,
    correctedPharmacy,
    quarantinedPharmacy
  );

  const totalRecords = claimSnapshot.totalRecords + pharmacySnapshot.totalRecords;
  const cleanRecords = claimSnapshot.cleanRecords + pharmacySnapshot.cleanRecords;
  const correctedRecords =
    claimSnapshot.correctedRecords + pharmacySnapshot.correctedRecords;
  const quarantinedRecords =
    claimSnapshot.quarantinedRecords + pharmacySnapshot.quarantinedRecords;
  const retainedRecords = cleanRecords + correctedRecords;

  const overallSnapshot = summarizeSource(
    totalRecords,
    cleanRecords,
    correctedRecords,
    quarantinedRecords
  );
  const issueSummary = issueAccumulator.summarize();

  return {
    beforeScore: overallSnapshot.beforeScore,
    afterScore: overallSnapshot.afterScore,
    improvement: overallSnapshot.improvement,
    totalRecords,
    cleanRecords,
    correctedRecords,
    quarantinedRecords,
    retainedRecords,
    issueSummary,
    sources: {
      rawClaims: claimSnapshot,
      rawPharmacy: pharmacySnapshot,
    },
  };
}
