import { NextResponse } from "next/server";
import { and, eq, inArray, like, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { members, sdoh } from "@/lib/schema";
import { auth } from "@/lib/auth";
import {
  type GovernanceRole,
  ROLE_POLICIES,
  isIntentAllowed,
  sanitizeRecord,
  getBlockedFields,
  getRoleNote,
  writeAuditLog,
} from "@/lib/governance";

export const dynamic = "force-dynamic";

interface GovernedQueryPayload {
  role: GovernanceRole;
  intent: string;
  filters?: {
    states?: string[];
    riskTier?: string;
    conditions?: string[];
    diabetesOnly?: boolean;
    minErVisits?: number;
    maxPcpVisits?: number;
    metroAreaContains?: string;
    adherenceBelow?: number;
    chronicMedOnly?: boolean;
  };
  scope?: "aggregated" | "member_level";
  limit?: number;
}

export async function POST(req: Request) {
  let userId = "anonymous";
  let sessionRole: GovernanceRole = "care_manager";
  try {
    const session = await auth();
    if (session?.user) {
      userId = (session.user as any).id ?? session.user.email ?? "anonymous";
      const rawRole = (session.user as any).role ?? "care_manager";
      if (rawRole in ROLE_POLICIES) sessionRole = rawRole as GovernanceRole;
    }
  } catch {
    // allow unauthenticated for demo
  }

  let payload: GovernedQueryPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON body" }, { status: 400 });
  }

  const role = (payload.role && payload.role in ROLE_POLICIES) ? payload.role : sessionRole;
  const intent = payload.intent || "cohort";

  if (!isIntentAllowed(role, intent)) {
    const auditId = await writeAuditLog({
      userId, userRole: role, action: `governed_query:${intent}`,
      toolArgs: payload.filters ?? {},
      resultSummary: "BLOCKED: intent not allowed",
      policyNote: `Role '${role}' is not authorized for '${intent}' queries.`,
    });
    return NextResponse.json({
      status: "error",
      error: `Role '${role}' is not authorized for '${intent}' queries.`,
      governance: { role, policyNote: getRoleNote(role), auditId },
    }, { status: 403 });
  }

  const filters = payload.filters ?? {};
  const limit = Math.min(payload.limit ?? 25, 100);
  const scope = payload.scope ?? "member_level";
  const blocked = getBlockedFields(role);
  const roleNote = getRoleNote(role);

  const whereConditions = [];
  if (filters.riskTier) whereConditions.push(eq(members.riskTier, filters.riskTier));
  if (filters.states && filters.states.length > 0) whereConditions.push(inArray(members.state, filters.states));
  if (filters.diabetesOnly) whereConditions.push(eq(members.diabetesFlag, 1));
  if (filters.conditions && filters.conditions.length > 0) {
    const condOr = or(...filters.conditions.map((c) => like(members.chronicConditions, `%${c}%`)));
    if (condOr) whereConditions.push(condOr);
  }
  if (filters.minErVisits != null) whereConditions.push(sql`${members.erVisits12m} >= ${filters.minErVisits}`);
  if (filters.maxPcpVisits != null) whereConditions.push(sql`${members.pcpVisits12m} <= ${filters.maxPcpVisits}`);
  if (filters.metroAreaContains) whereConditions.push(like(members.metroArea, `%${filters.metroAreaContains}%`));
  if (filters.adherenceBelow != null) whereConditions.push(sql`${members.adherenceScore} < ${filters.adherenceBelow}`);

  const rows = await db
    .select({
      id: members.id,
      memberReference: members.memberReference,
      name: members.name,
      state: members.state,
      city: members.city,
      metroArea: members.metroArea,
      age: members.age,
      riskScore: members.riskScore,
      riskTier: members.riskTier,
      hospitalVisitProb6m: members.hospitalVisitProb6m,
      chronicConditions: members.chronicConditions,
      riskDrivers: members.riskDrivers,
      recommendedActions: members.recommendedActions,
      selectionExplanation: members.selectionExplanation,
      erVisits12m: members.erVisits12m,
      pcpVisits12m: members.pcpVisits12m,
      adherenceScore: members.adherenceScore,
      pcpName: members.pcpName,
      sdohTransportation: sdoh.transportationFlag,
      sdohFood: sdoh.foodInsecurity,
      sdohHousing: sdoh.housingInstability,
    })
    .from(members)
    .leftJoin(sdoh, eq(members.id, sdoh.memberId))
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .orderBy(sql`${members.hospitalVisitProb6m} desc`)
    .limit(limit);

  const totalMatching = rows.length;
  const avgProb = totalMatching > 0 ? Math.round(rows.reduce((s, r) => s + (r.hospitalVisitProb6m ?? 0), 0) / totalMatching * 10000) / 10000 : 0;
  const highRiskCount = rows.filter((r) => r.riskTier === "high").length;

  let records: Record<string, unknown>[];
  if (scope === "aggregated") {
    const byState: Record<string, { count: number; avgRisk: number; totalRisk: number }> = {};
    for (const r of rows) {
      const s = r.state;
      if (!byState[s]) byState[s] = { count: 0, avgRisk: 0, totalRisk: 0 };
      byState[s].count++;
      byState[s].totalRisk += r.riskScore;
    }
    for (const s of Object.keys(byState)) {
      byState[s].avgRisk = Math.round(byState[s].totalRisk / byState[s].count * 100) / 100;
    }
    records = Object.entries(byState).map(([state, data]) => ({ state, memberCount: data.count, avgRiskScore: data.avgRisk }));
  } else {
    records = rows.map((m) => {
      const record: Record<string, unknown> = {
        memberReference: m.memberReference,
        name: m.name,
        state: m.state,
        city: m.city,
        metroArea: m.metroArea,
        age: m.age,
        riskScore: m.riskScore,
        riskTier: m.riskTier,
        hospitalVisitProb6m: m.hospitalVisitProb6m,
        chronicConditions: m.chronicConditions,
        riskDrivers: m.riskDrivers,
        recommendedActions: m.recommendedActions,
        selectionExplanation: m.selectionExplanation,
        erVisits12m: m.erVisits12m,
        pcpVisits12m: m.pcpVisits12m,
        adherenceScore: m.adherenceScore,
        pcpName: m.pcpName,
        sdoh: {
          transportationBarrier: m.sdohTransportation === 1,
          foodInsecurity: m.sdohFood === 1,
          housingInstability: m.sdohHousing === 1,
        },
      };
      return sanitizeRecord(record, role);
    });
  }

  const auditId = await writeAuditLog({
    userId, userRole: role, action: `governed_query:${intent}`,
    toolArgs: filters,
    resultSummary: `${totalMatching} members, scope=${scope}`,
    blockedFields: blocked,
    policyNote: roleNote,
  });

  return NextResponse.json({
    status: "ok",
    role,
    intent,
    scope,
    summary: {
      matchingMembers: totalMatching,
      avgProbability: avgProb,
      highRiskMembers: highRiskCount,
      states: [...new Set(rows.map((r) => r.state))].sort(),
    },
    records,
    governance: {
      policyNote: roleNote,
      blockedFields: blocked,
      auditId,
    },
  });
}
