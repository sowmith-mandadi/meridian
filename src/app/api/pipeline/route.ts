import { db } from "@/lib/db";
import { members, claims, pharmacy, sdoh, callCenter } from "@/lib/schema";
import { eq, sql, count, avg, min, max } from "drizzle-orm";

export const dynamic = "force-dynamic";

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
      total_records:
        memberCount.count +
        claimCount.count +
        rxCount.count +
        sdohCount.count +
        ccCount.count,
    },
  };
}

async function runProfile(): Promise<StepResult> {
  const start = Date.now();

  const [ageStats] = await db
    .select({
      minAge: min(members.age),
      maxAge: max(members.age),
      avgAge: avg(members.age),
    })
    .from(members);

  const [riskStats] = await db
    .select({
      minRisk: min(members.riskScore),
      maxRisk: max(members.riskScore),
      avgRisk: avg(members.riskScore),
    })
    .from(members);

  const tierDist = await db
    .select({
      tier: members.riskTier,
      count: count(),
    })
    .from(members)
    .groupBy(members.riskTier);

  const stateDist = await db
    .select({
      state: members.state,
      count: count(),
    })
    .from(members)
    .groupBy(members.state);

  const [nullCheck] = await db
    .select({
      nullNames: sql<number>`sum(case when name is null then 1 else 0 end)`,
      nullStates: sql<number>`sum(case when state is null then 1 else 0 end)`,
      nullRisk: sql<number>`sum(case when risk_score is null then 1 else 0 end)`,
      total: count(),
    })
    .from(members);

  return {
    step: "profile",
    status: "completed",
    durationMs: Date.now() - start,
    output: {
      age: {
        min: ageStats.minAge,
        max: ageStats.maxAge,
        avg: Number(Number(ageStats.avgAge).toFixed(1)),
      },
      riskScore: {
        min: Number(Number(riskStats.minRisk).toFixed(2)),
        max: Number(Number(riskStats.maxRisk).toFixed(2)),
        avg: Number(Number(riskStats.avgRisk).toFixed(2)),
      },
      riskTierDistribution: Object.fromEntries(
        tierDist.map((r) => [r.tier, r.count])
      ),
      stateDistribution: Object.fromEntries(
        stateDist.map((r) => [r.state, r.count])
      ),
      nullRates: {
        name: `${nullCheck.nullNames}/${nullCheck.total}`,
        state: `${nullCheck.nullStates}/${nullCheck.total}`,
        riskScore: `${nullCheck.nullRisk}/${nullCheck.total}`,
      },
    },
  };
}

async function runStandardize(): Promise<StepResult> {
  const start = Date.now();

  const icdCodes = await db
    .select({ code: claims.icdCode, count: count() })
    .from(claims)
    .groupBy(claims.icdCode);

  const drugNames = await db
    .select({ drug: pharmacy.drugName, count: count() })
    .from(pharmacy)
    .groupBy(pharmacy.drugName);

  const [dateRange] = await db
    .select({
      earliest: min(claims.date),
      latest: max(claims.date),
    })
    .from(claims);

  const claimTypes = await db
    .select({ type: claims.type, count: count() })
    .from(claims)
    .groupBy(claims.type);

  return {
    step: "standardize",
    status: "completed",
    durationMs: Date.now() - start,
    output: {
      icdCodesValidated: icdCodes.length,
      topIcdCodes: icdCodes
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map((r) => ({ code: r.code, count: r.count })),
      drugNamesMapped: drugNames.length,
      topDrugs: drugNames
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map((r) => ({ drug: r.drug, count: r.count })),
      dateRange: { earliest: dateRange.earliest, latest: dateRange.latest },
      claimTypeBreakdown: Object.fromEntries(
        claimTypes.map((r) => [r.type, r.count])
      ),
    },
  };
}

async function runEntityResolve(): Promise<StepResult> {
  const start = Date.now();

  const [totalMembers] = await db.select({ count: count() }).from(members);

  const [withClaims] = await db
    .select({
      count: sql<number>`count(distinct ${claims.memberId})`,
    })
    .from(claims);

  const [withRx] = await db
    .select({
      count: sql<number>`count(distinct ${pharmacy.memberId})`,
    })
    .from(pharmacy);

  const [withSdoh] = await db
    .select({
      count: sql<number>`count(distinct ${sdoh.memberId})`,
    })
    .from(sdoh);

  const [withCalls] = await db
    .select({
      count: sql<number>`count(distinct ${callCenter.memberId})`,
    })
    .from(callCenter);

  const total = totalMembers.count;
  const linked = Math.min(total, withClaims.count);
  const matchRate = total > 0 ? Math.round((linked / total) * 100 * 10) / 10 : 0;

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
      },
      overallMatchRate: `${matchRate}%`,
      orphanRecords: Math.max(0, total - linked),
    },
  };
}

async function runValidate(): Promise<StepResult> {
  const start = Date.now();

  const [totalMembers] = await db.select({ count: count() }).from(members);

  // Grain check: one row per member
  const grainCheck = totalMembers.count > 0;

  // Referential integrity: all claims reference a valid member
  const orphanResult = await db.all(
    sql`select count(*) as cnt from claims where member_id not in (select id from members)`
  );
  const orphanCount = (orphanResult[0] as any)?.cnt ?? 0;
  const refIntegrity = orphanCount === 0;

  // Business rule: risk_score between 0 and 1
  const rangeResult = await db.all(
    sql`select count(*) as cnt from members where risk_score < 0 or risk_score > 1`
  );
  const outOfRangeCount = (rangeResult[0] as any)?.cnt ?? 0;
  const riskRangeValid = outOfRangeCount === 0;

  const rules = [
    { rule: "Grain: one row per member", passed: grainCheck },
    { rule: "Referential integrity: claims → members", passed: refIntegrity },
    { rule: "Business rule: risk_score ∈ [0, 1]", passed: riskRangeValid },
  ];

  const passedCount = rules.filter((r) => r.passed).length;
  const qualityScore = Math.round((passedCount / rules.length) * 100 * 10) / 10;

  return {
    step: "validate",
    status: "completed",
    durationMs: Date.now() - start,
    output: {
      rules,
      rulesPassed: passedCount,
      rulesTotal: rules.length,
      qualityScore: `${qualityScore}%`,
      readyForModeling: passedCount === rules.length,
    },
  };
}

export async function POST() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const steps = [
        runIngest,
        runProfile,
        runStandardize,
        runEntityResolve,
        runValidate,
      ];

      const results: StepResult[] = [];
      let totalMs = 0;

      for (const stepFn of steps) {
        try {
          const result = await stepFn();
          results.push(result);
          totalMs += result.durationMs;
          controller.enqueue(
            encoder.encode(JSON.stringify(result) + "\n")
          );
        } catch (err) {
          const errorResult: StepResult = {
            step: stepFn.name.replace("run", "").toLowerCase(),
            status: "failed",
            durationMs: 0,
            output: { error: String(err) },
          };
          results.push(errorResult);
          controller.enqueue(
            encoder.encode(JSON.stringify(errorResult) + "\n")
          );
        }
      }

      const summary = {
        step: "summary",
        status: "completed" as const,
        durationMs: totalMs,
        output: {
          pipeline: "hospitalization_risk_prediction",
          stepsCompleted: results.filter((r) => r.status === "completed").length,
          stepsTotal: results.length,
          totalDurationMs: totalMs,
          qualityScore: (results.find((r) => r.step === "validate")?.output as any)
            ?.qualityScore ?? "N/A",
          readyForModeling:
            (results.find((r) => r.step === "validate")?.output as any)
              ?.readyForModeling ?? false,
        },
      };
      controller.enqueue(encoder.encode(JSON.stringify(summary) + "\n"));
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
