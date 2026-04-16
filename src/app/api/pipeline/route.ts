import { db } from "@/lib/db";
import {
  members,
  claims,
  pharmacy,
  sdoh,
  callCenter,
  utilization,
  pipelineRuns,
} from "@/lib/schema";
import { getPipelineQualitySnapshot } from "@/lib/pipeline-quality";
import { sql, count, avg, min, max } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const qualitySnapshot = await getPipelineQualitySnapshot();

  return Response.json({
    qualitySnapshot,
  });
}

const VALID_ICD_CODES = new Set([
  "E11.9", "I50.9", "J44.1", "I10", "N18.9", "J45.909", "F32.9", "Z00.0",
]);
const VALID_DRUGS = new Set([
  "Metformin", "Ozempic", "Jardiance", "Lisinopril", "Atorvastatin", "Losartan",
  "Albuterol", "Symbicort", "Sertraline", "Buspirone", "Amlodipine", "Omeprazole",
  "Insulin Glargine", "Furosemide",
]);

interface StepResult {
  step: string;
  status: "completed" | "failed";
  durationMs: number;
  output: Record<string, unknown>;
}

async function runIngest(): Promise<StepResult> {
  const start = Date.now();
  const [memberCount] = await db.select({ count: count() }).from(members);
  const [claimCount] = await db.select({ count: count() }).from(claims);
  const [rxCount] = await db.select({ count: count() }).from(pharmacy);
  const [sdohCount] = await db.select({ count: count() }).from(sdoh);
  const [ccCount] = await db.select({ count: count() }).from(callCenter);
  const [utilCount] = await db.select({ count: count() }).from(utilization);

  return {
    step: "ingest",
    status: "completed",
    durationMs: Date.now() - start,
    output: {
      members: memberCount.count,
      claims: claimCount.count,
      pharmacy: rxCount.count,
      sdoh: sdohCount.count,
      call_center: ccCount.count,
      utilization: utilCount.count,
      total_records:
        memberCount.count + claimCount.count + rxCount.count +
        sdohCount.count + ccCount.count + utilCount.count,
    },
  };
}

async function runProfile(): Promise<StepResult> {
  const start = Date.now();

  const [ageStats] = await db
    .select({ minAge: min(members.age), maxAge: max(members.age), avgAge: avg(members.age) })
    .from(members);

  const [riskStats] = await db
    .select({ minRisk: min(members.riskScore), maxRisk: max(members.riskScore), avgRisk: avg(members.riskScore) })
    .from(members);

  const tierDist = await db.select({ tier: members.riskTier, count: count() }).from(members).groupBy(members.riskTier);
  const stateDist = await db.select({ state: members.state, count: count() }).from(members).groupBy(members.state);

  const [memberNulls] = await db.select({
    nullNames: sql<number>`sum(case when name is null or name = '' then 1 else 0 end)`,
    nullStates: sql<number>`sum(case when state is null or state = '' then 1 else 0 end)`,
    nullRisk: sql<number>`sum(case when risk_score is null then 1 else 0 end)`,
    nullDrivers: sql<number>`sum(case when risk_drivers is null or risk_drivers = '' then 1 else 0 end)`,
    nullReference: sql<number>`sum(case when member_reference is null or member_reference = '' then 1 else 0 end)`,
    total: count(),
  }).from(members);

  const total = memberNulls.total || 1;
  const memberNullRate = ((memberNulls.nullNames + memberNulls.nullStates + memberNulls.nullRisk) / (total * 3));
  const [claimNulls] = await db.select({
    nullMemberId: sql<number>`sum(case when member_id is null or member_id = '' then 1 else 0 end)`,
    total: count(),
  }).from(claims);
  const claimNullRate = claimNulls.total > 0 ? claimNulls.nullMemberId / claimNulls.total : 0;

  const sourceQuality = {
    members: { nullRate: Math.round(memberNullRate * 10000) / 10000, qualityScore: Math.round(Math.max(0, 1.0 - memberNullRate * 0.55) * 10000) / 10000 },
    claims: { nullRate: Math.round(claimNullRate * 10000) / 10000, qualityScore: Math.round(Math.max(0, 1.0 - claimNullRate * 0.55) * 10000) / 10000 },
  };

  return {
    step: "profile",
    status: "completed",
    durationMs: Date.now() - start,
    output: {
      age: { min: ageStats.minAge, max: ageStats.maxAge, avg: Number(Number(ageStats.avgAge).toFixed(1)) },
      riskScore: {
        min: Number(Number(riskStats.minRisk).toFixed(2)),
        max: Number(Number(riskStats.maxRisk).toFixed(2)),
        avg: Number(Number(riskStats.avgRisk).toFixed(2)),
      },
      riskTierDistribution: Object.fromEntries(tierDist.map((r) => [r.tier, r.count])),
      stateDistribution: Object.fromEntries(stateDist.map((r) => [r.state, r.count])),
      nullRates: {
        name: `${memberNulls.nullNames}/${memberNulls.total}`,
        state: `${memberNulls.nullStates}/${memberNulls.total}`,
        riskScore: `${memberNulls.nullRisk}/${memberNulls.total}`,
        riskDrivers: `${memberNulls.nullDrivers}/${memberNulls.total}`,
        memberReference: `${memberNulls.nullReference}/${memberNulls.total}`,
      },
      sourceQuality,
    },
  };
}

async function runStandardize(): Promise<StepResult> {
  const start = Date.now();

  const icdCodes = await db.select({ code: claims.icdCode, count: count() }).from(claims).groupBy(claims.icdCode);
  const drugNames = await db.select({ drug: pharmacy.drugName, count: count() }).from(pharmacy).groupBy(pharmacy.drugName);
  const [dateRange] = await db.select({ earliest: min(claims.date), latest: max(claims.date) }).from(claims);
  const claimTypes = await db.select({ type: claims.type, count: count() }).from(claims).groupBy(claims.type);

  const validIcdCount = icdCodes.filter((r) => VALID_ICD_CODES.has(r.code)).length;
  const invalidIcdCodes = icdCodes.filter((r) => !VALID_ICD_CODES.has(r.code)).map((r) => r.code);
  const validDrugCount = drugNames.filter((r) => VALID_DRUGS.has(r.drug)).length;
  const invalidDrugs = drugNames.filter((r) => !VALID_DRUGS.has(r.drug)).map((r) => r.drug);

  const today = new Date().toISOString().split("T")[0];
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const [futureDates] = await db.select({
    cnt: sql<number>`sum(case when date > ${today} then 1 else 0 end)`,
  }).from(claims);
  const [oldDates] = await db.select({
    cnt: sql<number>`sum(case when date < ${fiveYearsAgo.toISOString().split("T")[0]} then 1 else 0 end)`,
  }).from(claims);

  return {
    step: "standardize",
    status: "completed",
    durationMs: Date.now() - start,
    output: {
      icdCodesValidated: validIcdCount,
      icdCodesTotal: icdCodes.length,
      invalidIcdCodes: invalidIcdCodes.slice(0, 10),
      topIcdCodes: icdCodes.sort((a, b) => b.count - a.count).slice(0, 5).map((r) => ({ code: r.code, count: r.count })),
      drugNamesMapped: validDrugCount,
      drugNamesTotal: drugNames.length,
      invalidDrugs: invalidDrugs.slice(0, 10),
      topDrugs: drugNames.sort((a, b) => b.count - a.count).slice(0, 5).map((r) => ({ drug: r.drug, count: r.count })),
      dateRange: { earliest: dateRange.earliest, latest: dateRange.latest },
      futureDatedClaims: futureDates.cnt ?? 0,
      staleClaims: oldDates.cnt ?? 0,
      claimTypeBreakdown: Object.fromEntries(claimTypes.map((r) => [r.type, r.count])),
    },
  };
}

async function runEntityResolve(): Promise<StepResult> {
  const start = Date.now();

  const [totalMembers] = await db.select({ count: count() }).from(members);
  const [withClaims] = await db.select({ count: sql<number>`count(distinct ${claims.memberId})` }).from(claims);
  const [withRx] = await db.select({ count: sql<number>`count(distinct ${pharmacy.memberId})` }).from(pharmacy);
  const [withSdoh] = await db.select({ count: sql<number>`count(distinct ${sdoh.memberId})` }).from(sdoh);
  const [withCalls] = await db.select({ count: sql<number>`count(distinct ${callCenter.memberId})` }).from(callCenter);
  const [withUtil] = await db.select({ count: sql<number>`count(distinct ${utilization.memberId})` }).from(utilization);

  const total = totalMembers.count || 1;
  const linkageRates = {
    claims: Math.round((withClaims.count / total) * 10000) / 100,
    pharmacy: Math.round((withRx.count / total) * 10000) / 100,
    sdoh: Math.round((withSdoh.count / total) * 10000) / 100,
    callCenter: Math.round((withCalls.count / total) * 10000) / 100,
    utilization: Math.round((withUtil.count / total) * 10000) / 100,
  };

  const orphanChecks = await Promise.all([
    db.all(sql`select count(*) as cnt from claims where member_id not in (select id from members)`),
    db.all(sql`select count(*) as cnt from pharmacy where member_id not in (select id from members)`),
    db.all(sql`select count(*) as cnt from sdoh where member_id not in (select id from members)`),
    db.all(sql`select count(*) as cnt from call_center where member_id not in (select id from members)`),
    db.all(sql`select count(*) as cnt from utilization where member_id not in (select id from members)`),
  ]);
  const orphans = {
    claims: (orphanChecks[0][0] as any)?.cnt ?? 0,
    pharmacy: (orphanChecks[1][0] as any)?.cnt ?? 0,
    sdoh: (orphanChecks[2][0] as any)?.cnt ?? 0,
    callCenter: (orphanChecks[3][0] as any)?.cnt ?? 0,
    utilization: (orphanChecks[4][0] as any)?.cnt ?? 0,
  };
  const totalOrphans = Object.values(orphans).reduce((s, v) => s + v, 0);

  return {
    step: "entity_resolve",
    status: "completed",
    durationMs: Date.now() - start,
    output: {
      totalMembers: total,
      linkedAcrossSources: {
        claims: withClaims.count,
        pharmacy: withRx.count,
        sdoh: withSdoh.count,
        callCenter: withCalls.count,
        utilization: withUtil.count,
      },
      linkageRates,
      orphanRecords: orphans,
      totalOrphans,
    },
  };
}

async function runValidate(): Promise<StepResult> {
  const start = Date.now();

  const [totalMembers] = await db.select({ count: count() }).from(members);
  const grainCheck = totalMembers.count > 0;

  const [uniqueCheck] = await db.select({
    distinctCount: sql<number>`count(distinct id)`,
    totalCount: count(),
  }).from(members);
  const memberIdUnique = uniqueCheck.distinctCount === uniqueCheck.totalCount;

  const [requiredCols] = await db.select({
    nullRef: sql<number>`sum(case when member_reference is null or member_reference = '' then 1 else 0 end)`,
    nullState: sql<number>`sum(case when state is null or state = '' then 1 else 0 end)`,
    nullTier: sql<number>`sum(case when risk_tier is null or risk_tier = '' then 1 else 0 end)`,
    nullDrivers: sql<number>`sum(case when risk_drivers is null or risk_drivers = '' then 1 else 0 end)`,
    total: count(),
  }).from(members);
  const requiredPresent = (requiredCols.nullRef + requiredCols.nullState + requiredCols.nullTier) === 0;

  const [rangeResult] = await db.select({
    cnt: sql<number>`sum(case when risk_score < 0 or risk_score > 1 then 1 else 0 end)`,
  }).from(members);
  const riskRangeValid = (rangeResult.cnt ?? 0) === 0;

  const [tierConsistency] = await db.select({
    cnt: sql<number>`sum(case
      when risk_tier = 'high' and risk_score < 0.70 then 1
      when risk_tier = 'low' and risk_score >= 0.40 then 1
      else 0 end)`,
  }).from(members);
  const tierConsistent = (tierConsistency.cnt ?? 0) === 0;

  const orphanResult = await Promise.all([
    db.all(sql`select count(*) as cnt from claims where member_id not in (select id from members)`),
    db.all(sql`select count(*) as cnt from pharmacy where member_id not in (select id from members)`),
    db.all(sql`select count(*) as cnt from sdoh where member_id not in (select id from members)`),
    db.all(sql`select count(*) as cnt from call_center where member_id not in (select id from members)`),
    db.all(sql`select count(*) as cnt from utilization where member_id not in (select id from members)`),
  ]);
  const totalOrphans = orphanResult.reduce((s, r) => s + ((r[0] as any)?.cnt ?? 0), 0);
  const refIntegrity = totalOrphans === 0;

  const critTotal = requiredCols.total || 1;
  const criticalCompleteness = 1 - ((requiredCols.nullRef + requiredCols.nullState + requiredCols.nullTier + requiredCols.nullDrivers) / (critTotal * 4));
  const completenessPass = criticalCompleteness >= 0.95;

  const tierCounts = await db.select({ tier: members.riskTier, count: count() }).from(members).groupBy(members.riskTier);
  const tiers = tierCounts.map((r) => r.count);
  const reasonableDistribution = tiers.length >= 2 && !tiers.some((t) => t === totalMembers.count);

  const [totalClaims] = await db.select({ count: count() }).from(claims);
  const [linkedClaims] = await db.select({ count: sql<number>`count(distinct member_id)` }).from(claims);
  const linkageRate = totalMembers.count > 0 ? linkedClaims.count / totalMembers.count : 0;
  const linkagePass = linkageRate >= 0.90;

  const rules = [
    { rule: "Dataset not empty", passed: grainCheck },
    { rule: "Member ID unique", passed: memberIdUnique },
    { rule: "Required columns present (reference, state, tier)", passed: requiredPresent },
    { rule: "Risk score in [0, 1]", passed: riskRangeValid },
    { rule: "Risk tier consistent with score", passed: tierConsistent },
    { rule: "Referential integrity across all fact tables", passed: refIntegrity },
    { rule: "Critical field completeness >= 95%", passed: completenessPass },
    { rule: "Risk tier distribution is reasonable", passed: reasonableDistribution },
    { rule: "Linkage quality gate >= 90%", passed: linkagePass },
  ];

  const passedCount = rules.filter((r) => r.passed).length;
  const qualityScore = Math.round((passedCount / rules.length) * 1000) / 10;

  return {
    step: "validate",
    status: "completed",
    durationMs: Date.now() - start,
    output: {
      rules,
      rulesPassed: passedCount,
      rulesTotal: rules.length,
      qualityScore: `${qualityScore}%`,
      criticalCompleteness: `${Math.round(criticalCompleteness * 10000) / 100}%`,
      linkageRate: `${Math.round(linkageRate * 10000) / 100}%`,
      readyForModeling: passedCount === rules.length,
    },
  };
}

export async function POST() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const qualitySnapshot = await getPipelineQualitySnapshot();
      const steps = [runIngest, runProfile, runStandardize, runEntityResolve, runValidate];
      const results: StepResult[] = [];
      let totalMs = 0;

      for (const stepFn of steps) {
        try {
          const result = await stepFn();
          results.push(result);
          totalMs += result.durationMs;
          controller.enqueue(encoder.encode(JSON.stringify(result) + "\n"));
        } catch (err) {
          const errorResult: StepResult = {
            step: stepFn.name.replace("run", "").toLowerCase(),
            status: "failed",
            durationMs: 0,
            output: { error: String(err) },
          };
          results.push(errorResult);
          controller.enqueue(encoder.encode(JSON.stringify(errorResult) + "\n"));
        }
      }

      const validateOutput = results.find((r) => r.step === "validate")?.output as any;
      const qualityScore = parseFloat(String(validateOutput?.qualityScore ?? "0").replace("%", ""));

      const summary = {
        step: "summary",
        status: "completed" as const,
        durationMs: totalMs,
        output: {
          pipeline: "hospitalization_risk_prediction",
          stepsCompleted: results.filter((r) => r.status === "completed").length,
          stepsTotal: results.length,
          totalDurationMs: totalMs,
          qualityScore: validateOutput?.qualityScore ?? "N/A",
          qualitySnapshot,
          readyForModeling: validateOutput?.readyForModeling ?? false,
        },
      };
      controller.enqueue(encoder.encode(JSON.stringify(summary) + "\n"));

      try {
        await db.insert(pipelineRuns).values({
          id: crypto.randomUUID(),
          status: summary.output.readyForModeling ? "passed" : "failed",
          stepsCompleted: summary.output.stepsCompleted,
          totalSteps: summary.output.stepsTotal,
          qualityScore: qualityScore / 100,
          profilingJson: JSON.stringify(results.find((r) => r.step === "profile")?.output ?? {}),
          validationJson: JSON.stringify(validateOutput ?? {}),
          durationMs: totalMs,
          createdAt: new Date().toISOString(),
        });
      } catch {
        // non-critical
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
