import { drizzle } from "drizzle-orm/libsql/node";
import { sql } from "drizzle-orm";
import * as schema from "../src/lib/schema";

// ── Seed RNG (deterministic) ───────────────────────────────────────────────

class SeededRng {
  private state: number;
  constructor(seed: number) {
    this.state = seed;
  }
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) & 0xffffffff;
    return (this.state >>> 0) / 0xffffffff;
  }
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  pickWeighted<T extends { weight: number }>(arr: T[]): T {
    const total = arr.reduce((s, x) => s + x.weight, 0);
    let r = this.next() * total;
    for (const item of arr) {
      r -= item.weight;
      if (r <= 0) return item;
    }
    return arr[arr.length - 1];
  }
  sample<T>(arr: T[], k: number): T[] {
    const copy = [...arr];
    const result: T[] = [];
    for (let i = 0; i < Math.min(k, copy.length); i++) {
      const idx = Math.floor(this.next() * copy.length);
      result.push(copy.splice(idx, 1)[0]);
    }
    return result;
  }
}

// ── Reference data ─────────────────────────────────────────────────────────

const FIRST_NAMES = [
  "James", "Maria", "Robert", "Linda", "Michael", "Patricia", "William", "Jennifer",
  "David", "Elizabeth", "Carlos", "Rosa", "Anthony", "Susan", "Thomas", "Sarah",
  "Daniel", "Angela", "Jose", "Margaret",
];
const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Martinez", "Davis",
  "Rodriguez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Lee",
  "Perez", "Thompson", "White", "Harris",
];

const GEOGRAPHIES = [
  { state: "TX", city: "Dallas", county: "Dallas", metro: "Dallas-Fort Worth", zip: "75201", weight: 0.22 },
  { state: "TX", city: "Houston", county: "Harris", metro: "Houston Metro", zip: "77002", weight: 0.14 },
  { state: "FL", city: "Miami", county: "Miami-Dade", metro: "Miami Metro", zip: "33101", weight: 0.18 },
  { state: "FL", city: "Orlando", county: "Orange", metro: "Orlando Metro", zip: "32801", weight: 0.12 },
  { state: "CA", city: "Los Angeles", county: "Los Angeles", metro: "Los Angeles Metro", zip: "90012", weight: 0.14 },
  { state: "GA", city: "Atlanta", county: "Fulton", metro: "Atlanta Metro", zip: "30303", weight: 0.10 },
  { state: "NY", city: "New York", county: "New York", metro: "NYC Metro", zip: "10001", weight: 0.10 },
];

const PCP_DIRECTORY = [
  { id: "PCP100", name: "Dr. Reyes" }, { id: "PCP101", name: "Dr. Chen" },
  { id: "PCP102", name: "Dr. Shah" }, { id: "PCP103", name: "Dr. Robinson" },
  { id: "PCP104", name: "Dr. Brooks" }, { id: "PCP105", name: "Dr. Allen" },
];

const CONDITIONS = ["Diabetes Type 2", "CHF", "COPD", "Hypertension", "CKD", "Asthma", "Depression"];
const ICD_CODES: Record<string, string> = {
  "Diabetes Type 2": "E11.9", CHF: "I50.9", COPD: "J44.1",
  Hypertension: "I10", CKD: "N18.9", Asthma: "J45.909", Depression: "F32.9",
};

const DRUG_LIBRARY: Record<string, { name: string; cls: string }[]> = {
  diabetes: [{ name: "Metformin", cls: "Antidiabetic" }, { name: "Ozempic", cls: "GLP-1" }, { name: "Jardiance", cls: "SGLT2" }],
  cardio: [{ name: "Lisinopril", cls: "ACE Inhibitor" }, { name: "Atorvastatin", cls: "Statin" }, { name: "Losartan", cls: "ARB" }],
  respiratory: [{ name: "Albuterol", cls: "Bronchodilator" }, { name: "Symbicort", cls: "Corticosteroid" }],
  behavioral: [{ name: "Sertraline", cls: "SSRI" }, { name: "Buspirone", cls: "Anxiolytic" }],
};

const CALL_REASONS = [
  "Appointment scheduling", "Medication refill", "Billing inquiry",
  "Symptom question", "Transportation need", "Coverage question",
  "Complaint", "Care coordination",
];

const PROVIDERS = [
  "Memorial Hospital", "St. Mary's Medical", "Regional Health Center",
  "Community Care Clinic", "University Hospital",
];

// ── Risk scoring (ported from Apoorv's feature_engineering._score_member) ──

interface MemberFeatures {
  diabetesFlag: number;
  erVisits12m: number;
  inpatientVisits12m: number;
  pcpVisits12m: number;
  transportationBarrier: number;
  adherenceScore: number;
  chronicMedCount: number;
  hba1cGapFlag: number;
  unresolvedCalls: number;
  escalations: number;
  socialRiskCount: number;
  totalClaimCost: number;
  transportCalls: number;
}

function scoreMember(f: MemberFeatures) {
  let prob = 0.09;
  const contributions: Record<string, number> = {};

  if (f.diabetesFlag) prob += 0.11;
  if (f.erVisits12m >= 3) contributions["frequent ER use"] = 0.22;
  else if (f.erVisits12m >= 1) contributions["frequent ER use"] = 0.11;
  if (f.inpatientVisits12m >= 1) contributions["recent inpatient stay"] = 0.18;
  if (f.transportationBarrier || f.transportCalls >= 1)
    contributions["transportation barrier"] = 0.17;
  if (f.adherenceScore < 60 && f.chronicMedCount > 0)
    contributions["poor medication adherence"] = 0.19;
  else if (f.adherenceScore < 75 && f.chronicMedCount > 0)
    contributions["poor medication adherence"] = 0.08;
  if (f.hba1cGapFlag) contributions["missing HbA1c monitoring"] = 0.12;
  if (f.pcpVisits12m === 0 && f.erVisits12m >= 1)
    contributions["low PCP engagement"] = 0.13;
  if (f.unresolvedCalls >= 1 || f.escalations >= 1)
    contributions["unresolved service issues"] = 0.10;
  if (f.socialRiskCount >= 2) contributions["social complexity"] = 0.08;
  if (f.totalClaimCost >= 12000) contributions["high recent cost"] = 0.07;

  prob += Object.values(contributions).reduce((s, v) => s + v, 0);
  if (f.pcpVisits12m >= 2) prob -= 0.05;
  if (f.adherenceScore >= 85) prob -= 0.04;
  if (!f.hba1cGapFlag && f.diabetesFlag) prob -= 0.03;

  prob = Math.round(Math.min(Math.max(prob, 0.03), 0.97) * 10000) / 10000;

  const ranked = Object.entries(contributions).sort((a, b) => b[1] - a[1]);
  const topDrivers = ranked.slice(0, 3).map(([d]) => d);
  if (topDrivers.length === 0) topDrivers.push("routine monitoring");

  const ACTION_MAP: Record<string, string> = {
    "transportation barrier": "Arrange transportation assistance or telehealth backup.",
    "poor medication adherence": "Schedule pharmacy outreach for refill sync and adherence coaching.",
    "frequent ER use": "Prioritize case management outreach and book rapid PCP follow-up.",
    "recent inpatient stay": "Complete post-discharge follow-up and medication reconciliation.",
    "missing HbA1c monitoring": "Schedule HbA1c lab and diabetic preventive follow-up within 30 days.",
    "low PCP engagement": "Coordinate PCP appointment and reinforce primary-care navigation.",
    "unresolved service issues": "Close open service issues and remove administrative barriers.",
    "social complexity": "Route to social support navigation for barrier assessment.",
    "high recent cost": "Review utilization and escalate for intensive care management.",
    "routine monitoring": "Continue routine wellness check-in and preventive care.",
  };

  const actions = topDrivers.map((d) => ACTION_MAP[d] ?? "Review the member's care plan.");
  const tier = prob >= 0.70 ? "high" : prob >= 0.40 ? "medium" : "low";

  let explanation = `Selected because ${topDrivers.slice(0, 2).join(", ")}`;
  if (topDrivers.length > 2) explanation += `, with additional impact from ${topDrivers[2]}`;
  explanation += ".";

  return {
    hospitalVisitProb6m: prob,
    riskScore: Math.round(prob * 100) / 100,
    riskTier: tier,
    riskDrivers: topDrivers.join("; "),
    recommendedActions: actions.join("; "),
    selectionExplanation: explanation,
  };
}

// ── Date helpers ───────────────────────────────────────────────────────────

function dateInPast(rng: SeededRng, maxDays: number, minDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - rng.int(minDays, maxDays));
  return d.toISOString().split("T")[0];
}

function uid(rng: SeededRng): string {
  return rng.int(100000, 999999).toString(36) + rng.int(100000, 999999).toString(36);
}

// ── Main seed ──────────────────────────────────────────────────────────────

async function seed() {
  const url = process.env.TURSO_DATABASE_URL || "file:local.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  console.log(`Connecting to: ${url.startsWith("file:") ? url : url.replace(/\/\/.*@/, "//***@")}`);
  const db = drizzle({ connection: { url, authToken }, schema });

  console.log("Clearing existing data...");
  await db.run(sql`DELETE FROM ${schema.usageLog}`);
  await db.run(sql`DELETE FROM ${schema.feedbackRequests}`);
  await db.run(sql`DELETE FROM ${schema.auditLog}`);
  await db.run(sql`DELETE FROM ${schema.pipelineRuns}`);
  await db.run(sql`DELETE FROM ${schema.callCenter}`);
  await db.run(sql`DELETE FROM ${schema.utilization}`);
  await db.run(sql`DELETE FROM ${schema.sdoh}`);
  await db.run(sql`DELETE FROM ${schema.pharmacy}`);
  await db.run(sql`DELETE FROM ${schema.claims}`);
  await db.run(sql`DELETE FROM ${schema.members}`);
  await db.run(sql`DELETE FROM ${schema.users}`);
  console.log("  Existing data cleared.");

  console.log("Seeding database...");
  const rng = new SeededRng(42);

  await db.insert(schema.users).values([
    { id: "u-care", email: "care_manager@demo.com", password: "demo123", name: "Dr. Sarah Chen", role: "care_manager" },
    { id: "u-analyst", email: "analyst@demo.com", password: "demo123", name: "Alex Rivera", role: "analyst" },
    { id: "u-quality", email: "quality@demo.com", password: "demo123", name: "Morgan Liu", role: "quality" },
    { id: "u-admin", email: "admin@demo.com", password: "demo123", name: "Jordan Taylor", role: "admin" },
  ]);
  console.log("  Users: 4 created");

  const memberRows: (typeof schema.members.$inferInsert)[] = [];
  const claimRows: (typeof schema.claims.$inferInsert)[] = [];
  const pharmacyRows: (typeof schema.pharmacy.$inferInsert)[] = [];
  const sdohRows: (typeof schema.sdoh.$inferInsert)[] = [];
  const callCenterRows: (typeof schema.callCenter.$inferInsert)[] = [];
  const utilizationRows: (typeof schema.utilization.$inferInsert)[] = [];

  for (let i = 0; i < 500; i++) {
    const mid = `M-${String(i + 1000).padStart(4, "0")}`;
    const memberRef = `MBR-${String(i + 1).padStart(3, "0")}`;
    const geo = rng.pickWeighted(GEOGRAPHIES);
    const pcp = PCP_DIRECTORY[i % PCP_DIRECTORY.length];
    const age = rng.int(28, 82);
    const gender = rng.next() < 0.5 ? "M" : "F";
    const name = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;

    const diabetesFlag = rng.next() < (geo.state === "TX" || geo.state === "FL" ? 0.55 : 0.35) ? 1 : 0;
    const conditions: string[] = [];
    if (diabetesFlag) conditions.push("Diabetes Type 2");
    for (const c of CONDITIONS.filter((x) => x !== "Diabetes Type 2")) {
      if (rng.next() < 0.22) conditions.push(c);
    }
    if (conditions.length === 0) conditions.push(rng.pick(CONDITIONS));

    const transportBarrier = rng.next() < (geo.state === "TX" || geo.state === "FL" ? 0.34 : 0.18) ? 1 : 0;
    const foodInsecurity = rng.next() < 0.20 ? 1 : 0;
    const housingInstability = rng.next() < 0.15 ? 1 : 0;
    const financialStress = rng.next() < 0.25 ? 1 : 0;
    const socialIsolation = rng.next() < 0.12 ? 1 : 0;
    const socialRiskCount = transportBarrier + foodInsecurity + housingInstability + financialStress + socialIsolation;

    const dallasCoordGap = geo.metro === "Dallas-Fort Worth" && rng.next() < 0.30;
    const medAdherenceIssue = rng.next() < 0.28;
    const qualityGap = diabetesFlag && rng.next() < 0.33;

    // Utilization records
    let erCount = 0;
    let inpatientCount = 0;
    let pcpCount = 0;
    if (dallasCoordGap) {
      erCount = rng.int(3, 5);
      pcpCount = 0;
    } else {
      erCount = rng.int(0, diabetesFlag || transportBarrier ? 3 : 1);
      pcpCount = rng.int(0, 3);
    }
    inpatientCount = rng.next() < (erCount >= 2 ? 0.45 : 0.15) ? rng.int(1, 2) : 0;

    for (let e = 0; e < erCount; e++) {
      utilizationRows.push({
        id: `UTIL-${mid}-ER-${e}`,
        memberId: mid,
        eventType: "ER",
        eventDate: dateInPast(rng, 365, 1),
        avoidableFlag: rng.next() < 0.50 ? 1 : 0,
        lengthOfStay: 0,
        providerId: pcp.id,
      });
    }
    for (let e = 0; e < inpatientCount; e++) {
      utilizationRows.push({
        id: `UTIL-${mid}-IP-${e}`,
        memberId: mid,
        eventType: "INPATIENT",
        eventDate: dateInPast(rng, 365, 1),
        avoidableFlag: 0,
        lengthOfStay: rng.int(1, 7),
        providerId: pcp.id,
      });
    }
    for (let e = 0; e < pcpCount; e++) {
      utilizationRows.push({
        id: `UTIL-${mid}-PCP-${e}`,
        memberId: mid,
        eventType: "PCP",
        eventDate: dateInPast(rng, 365, 1),
        avoidableFlag: 0,
        lengthOfStay: 0,
        providerId: pcp.id,
      });
    }
    if (rng.next() < 0.34) {
      utilizationRows.push({
        id: `UTIL-${mid}-OBS-0`,
        memberId: mid,
        eventType: "OBSERVATION",
        eventDate: dateInPast(rng, 365, 1),
        avoidableFlag: rng.next() < 0.50 ? 1 : 0,
        lengthOfStay: rng.int(0, 2),
        providerId: pcp.id,
      });
    }

    // Claims
    let totalClaimCost = 0;
    for (const cond of conditions) {
      const numClaims = rng.int(1, 4);
      for (let c = 0; c < numClaims; c++) {
        const claimType = rng.pick(["inpatient", "outpatient", "emergency", "lab"]);
        const amount = claimType === "emergency" ? rng.int(850, 2600) :
          claimType === "inpatient" ? rng.int(9000, 25000) :
          claimType === "lab" ? rng.int(40, 200) :
          rng.int(90, 750);
        totalClaimCost += amount;
        claimRows.push({
          id: `C-${uid(rng)}`,
          memberId: mid,
          icdCode: ICD_CODES[cond] || "Z00.0",
          type: claimType,
          amount: Math.round(amount * 100) / 100,
          date: dateInPast(rng, 365),
          provider: rng.pick(PROVIDERS),
        });
      }
    }

    // Pharmacy
    const candidateDrugs: { name: string; cls: string }[] = [];
    if (diabetesFlag) candidateDrugs.push(...DRUG_LIBRARY.diabetes);
    candidateDrugs.push(...DRUG_LIBRARY.cardio);
    if (rng.next() < 0.30) candidateDrugs.push(...DRUG_LIBRARY.respiratory);
    if (rng.next() < 0.22) candidateDrugs.push(...DRUG_LIBRARY.behavioral);

    const drugs = rng.sample(candidateDrugs, rng.int(1, 3));
    let adherenceSum = 0;
    for (let r = 0; r < drugs.length; r++) {
      const drug = drugs[r];
      const lowAdherence = medAdherenceIssue &&
        ["Antidiabetic", "GLP-1", "SGLT2", "Statin"].includes(drug.cls);
      const pdc = lowAdherence ? rng.int(35, 58) : rng.int(68, 95);
      adherenceSum += pdc;
      pharmacyRows.push({
        id: `RX-${uid(rng)}`,
        memberId: mid,
        drugName: drug.name,
        drugClass: drug.cls,
        adherencePct: pdc,
        fillDate: dateInPast(rng, 180, 5),
      });
    }
    const avgAdherence = drugs.length > 0 ? Math.round(adherenceSum / drugs.length * 10) / 10 : 100;

    // SDOH
    sdohRows.push({
      id: `S-${uid(rng)}`,
      memberId: mid,
      transportationFlag: transportBarrier,
      foodInsecurity,
      housingInstability,
      financialStress,
      socialIsolation,
    });

    // Call center
    const callCount = rng.int(0, erCount >= 2 ? 3 : 1);
    let unresolvedCalls = 0;
    let escalations = 0;
    let transportCalls = 0;
    for (let c = 0; c < callCount; c++) {
      const isTransportCall = transportBarrier && rng.next() < 0.42;
      const isMedCall = medAdherenceIssue && rng.next() < 0.38;
      const reason = isTransportCall ? "Transportation need" :
        isMedCall ? "Medication refill" : rng.pick(CALL_REASONS);
      const unresolved = ["Transportation need", "Medication refill", "Billing inquiry"].includes(reason) && rng.next() < 0.58 ? 1 : 0;
      const escalated = unresolved && rng.next() < 0.44 ? 1 : 0;
      unresolvedCalls += unresolved;
      escalations += escalated;
      if (isTransportCall) transportCalls++;
      callCenterRows.push({
        id: `CC-${uid(rng)}`,
        memberId: mid,
        reason,
        sentiment: unresolved ? "negative" : rng.pick(["neutral", "positive"]),
        date: dateInPast(rng, 180, 2),
        unresolvedFlag: unresolved,
        escalatedFlag: escalated,
      });
    }

    // Score member from features
    const features: MemberFeatures = {
      diabetesFlag,
      erVisits12m: erCount,
      inpatientVisits12m: inpatientCount,
      pcpVisits12m: pcpCount,
      transportationBarrier: transportBarrier,
      adherenceScore: avgAdherence,
      chronicMedCount: drugs.length,
      hba1cGapFlag: qualityGap ? 1 : 0,
      unresolvedCalls,
      escalations,
      socialRiskCount,
      totalClaimCost,
      transportCalls,
    };
    const scored = scoreMember(features);

    memberRows.push({
      id: mid,
      name,
      memberReference: memberRef,
      state: geo.state,
      city: geo.city,
      county: geo.county,
      metroArea: geo.metro,
      zipCode: geo.zip,
      age,
      gender,
      riskScore: scored.riskScore,
      riskTier: scored.riskTier,
      chronicConditions: conditions.join(", "),
      hospitalVisitProb6m: scored.hospitalVisitProb6m,
      diabetesFlag,
      hba1cGapFlag: qualityGap ? 1 : 0,
      pcpId: pcp.id,
      pcpName: pcp.name,
      erVisits12m: erCount,
      pcpVisits12m: pcpCount,
      inpatientVisits12m: inpatientCount,
      adherenceScore: avgAdherence,
      riskDrivers: scored.riskDrivers,
      recommendedActions: scored.recommendedActions,
      selectionExplanation: scored.selectionExplanation,
    });
  }

  // Batch insert
  const BATCH = 100;
  for (let i = 0; i < memberRows.length; i += BATCH) {
    await db.insert(schema.members).values(memberRows.slice(i, i + BATCH));
  }
  console.log(`  Members: ${memberRows.length}`);

  for (let i = 0; i < claimRows.length; i += BATCH) {
    await db.insert(schema.claims).values(claimRows.slice(i, i + BATCH));
  }
  console.log(`  Claims: ${claimRows.length}`);

  for (let i = 0; i < pharmacyRows.length; i += BATCH) {
    await db.insert(schema.pharmacy).values(pharmacyRows.slice(i, i + BATCH));
  }
  console.log(`  Pharmacy: ${pharmacyRows.length}`);

  for (let i = 0; i < sdohRows.length; i += BATCH) {
    await db.insert(schema.sdoh).values(sdohRows.slice(i, i + BATCH));
  }
  console.log(`  SDOH: ${sdohRows.length}`);

  for (let i = 0; i < callCenterRows.length; i += BATCH) {
    await db.insert(schema.callCenter).values(callCenterRows.slice(i, i + BATCH));
  }
  console.log(`  Call Center: ${callCenterRows.length}`);

  for (let i = 0; i < utilizationRows.length; i += BATCH) {
    await db.insert(schema.utilization).values(utilizationRows.slice(i, i + BATCH));
  }
  console.log(`  Utilization: ${utilizationRows.length}`);

  console.log("Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
