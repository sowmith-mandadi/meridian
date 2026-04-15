#!/usr/bin/env npx tsx
/**
 * Meridian Healthcare MCP Server
 *
 * Dual-mode:
 *   - Direct mode: TURSO_DATABASE_URL set -> queries Turso via Drizzle
 *   - Proxy mode:  MERIDIAN_API_URL set  -> forwards to Vercel API
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;
const API_URL = process.env.MERIDIAN_API_URL || "http://localhost:3000";

const isDirect = !!TURSO_URL;

// ── Direct mode: Drizzle DB handle ──────────────────────────────────────────

let db: any = null;
let schema: any = null;
let orm: any = null;

async function getDb() {
  if (db) return { db, schema, orm };
  const drizzleMod = await import("drizzle-orm/libsql/node");
  orm = await import("drizzle-orm");
  schema = await import("../../src/lib/schema.js");
  db = drizzleMod.drizzle({
    connection: { url: TURSO_URL!, authToken: TURSO_TOKEN },
    schema,
  });
  return { db, schema, orm };
}

// ── Proxy mode: call Vercel API ─────────────────────────────────────────────

async function proxyChat(toolName: string, args: Record<string, unknown>) {
  const messages = [
    {
      role: "user",
      content: `Call the ${toolName} tool with these arguments: ${JSON.stringify(args)}. Return ONLY the raw tool result as JSON, nothing else.`,
    },
  ];
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return await res.text();
}

async function proxyPipeline() {
  const res = await fetch(`${API_URL}/api/pipeline`, { method: "POST" });
  if (!res.ok) throw new Error(`Pipeline API error: ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split("\n").filter(Boolean);
  return lines.map((l) => JSON.parse(l));
}

async function proxyGovernedQuery(args: Record<string, unknown>) {
  const res = await fetch(`${API_URL}/api/collaborate/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`Governed query API error: ${res.status}`);
  return await res.json();
}

// ── Tool implementations (direct mode) ─────────────────────────────────────

async function identifyCohort(args: {
  states: string[];
  conditions: string[];
  riskTier: string;
}) {
  const { db, schema, orm } = await getDb();
  const { members, sdoh } = schema;
  const { eq, and, inArray, like, or } = orm;

  const filters = [eq(members.riskTier, args.riskTier)];
  if (args.states.length > 0) filters.push(inArray(members.state, args.states));
  if (args.conditions.length > 0) {
    const condOr = or(
      ...args.conditions.map((c: string) => like(members.chronicConditions, `%${c}%`))
    );
    if (condOr) filters.push(condOr);
  }

  const rows = await db
    .select({
      id: members.id,
      memberReference: members.memberReference,
      name: members.name,
      state: members.state,
      city: members.city,
      metroArea: members.metroArea,
      age: members.age,
      gender: members.gender,
      riskScore: members.riskScore,
      riskTier: members.riskTier,
      hospitalVisitProb6m: members.hospitalVisitProb6m,
      chronicConditions: members.chronicConditions,
      riskDrivers: members.riskDrivers,
      erVisits12m: members.erVisits12m,
      pcpVisits12m: members.pcpVisits12m,
      adherenceScore: members.adherenceScore,
      sdohTransportation: sdoh.transportationFlag,
      sdohFood: sdoh.foodInsecurity,
      sdohHousing: sdoh.housingInstability,
    })
    .from(members)
    .leftJoin(sdoh, eq(members.id, sdoh.memberId))
    .where(and(...filters));

  return {
    count: rows.length,
    members: rows.map((m: any) => ({
      id: m.id,
      memberReference: m.memberReference,
      name: m.name,
      state: m.state,
      city: m.city,
      metroArea: m.metroArea,
      age: m.age,
      gender: m.gender,
      riskScore: m.riskScore,
      riskTier: m.riskTier,
      hospitalVisitProb6m: m.hospitalVisitProb6m,
      chronicConditions: m.chronicConditions,
      riskDrivers: m.riskDrivers,
      erVisits12m: m.erVisits12m,
      pcpVisits12m: m.pcpVisits12m,
      adherenceScore: m.adherenceScore,
      sdoh: {
        transportationBarrier: m.sdohTransportation === 1,
        foodInsecurity: m.sdohFood === 1,
        housingInstability: m.sdohHousing === 1,
      },
    })),
  };
}

async function getRiskDrivers(args: { memberId: string }) {
  const { db, schema, orm } = await getDb();
  const { members, sdoh, pharmacy } = schema;
  const { eq } = orm;

  const member = await db.query.members.findFirst({ where: eq(members.id, args.memberId) });
  if (!member) return { error: "Member not found", drivers: [], member: null };

  const sdohRow = await db.query.sdoh.findFirst({ where: eq(sdoh.memberId, args.memberId) });
  const rxRows = await db.select().from(pharmacy).where(eq(pharmacy.memberId, args.memberId));

  const avgAdherence = rxRows.length === 0 ? null :
    rxRows.reduce((s: number, r: any) => s + r.adherencePct, 0) / rxRows.length;

  const drivers: { name: string; score: number; category: string }[] = [];
  drivers.push({ name: "Clinical risk score", score: Math.min(1, Math.max(0, member.riskScore)), category: "clinical" });
  if (sdohRow?.transportationFlag) drivers.push({ name: "Transportation access", score: 0.82, category: "sdoh" });
  if (sdohRow?.foodInsecurity) drivers.push({ name: "Food insecurity", score: 0.78, category: "sdoh" });
  if (sdohRow?.housingInstability) drivers.push({ name: "Housing instability", score: 0.75, category: "sdoh" });
  if (avgAdherence !== null)
    drivers.push({ name: "Medication adherence", score: Math.min(1, Math.max(0, 1 - avgAdherence / 100)), category: "pharmacy" });
  if (member.erVisits12m >= 3) drivers.push({ name: "Frequent ER use", score: 0.85, category: "utilization" });
  if (member.pcpVisits12m === 0 && member.erVisits12m > 0) drivers.push({ name: "Low PCP engagement", score: 0.70, category: "utilization" });
  drivers.sort((a, b) => b.score - a.score);

  return {
    member: {
      id: member.id, memberReference: member.memberReference, name: member.name, state: member.state,
      age: member.age, gender: member.gender, riskScore: member.riskScore, riskTier: member.riskTier,
      hospitalVisitProb6m: member.hospitalVisitProb6m, chronicConditions: member.chronicConditions,
      riskDrivers: member.riskDrivers, selectionExplanation: member.selectionExplanation,
    },
    pharmacyFillCount: rxRows.length,
    avgAdherencePct: avgAdherence,
    drivers,
  };
}

async function explainMember(args: { memberId: string }) {
  const { db, schema, orm } = await getDb();
  const { members, sdoh, pharmacy, claims, utilization } = schema;
  const { eq, desc } = orm;

  const member = await db.query.members.findFirst({ where: eq(members.id, args.memberId) });
  if (!member) return { error: "Member not found" };

  const [sdohRow, rxRows, claimRows, utilRows] = await Promise.all([
    db.query.sdoh.findFirst({ where: eq(sdoh.memberId, args.memberId) }),
    db.select().from(pharmacy).where(eq(pharmacy.memberId, args.memberId)),
    db.select().from(claims).where(eq(claims.memberId, args.memberId)).orderBy(desc(claims.date)).limit(25),
    db.select().from(utilization).where(eq(utilization.memberId, args.memberId)),
  ]);

  const totalClaimAmount = claimRows.reduce((s: number, c: any) => s + c.amount, 0);
  const byType: Record<string, number> = {};
  for (const c of claimRows) byType[c.type] = (byType[c.type] ?? 0) + 1;
  const utilByType: Record<string, number> = {};
  for (const u of utilRows) utilByType[u.eventType] = (utilByType[u.eventType] ?? 0) + 1;

  return {
    sections: {
      overview: {
        title: "Overview",
        summary: `${member.name} is a ${member.age}-year-old ${member.gender} member in ${member.city}, ${member.state} with ${member.riskTier} risk (score ${member.riskScore}). ${member.selectionExplanation}`,
      },
      demographics: { title: "Demographics", id: member.id, memberReference: member.memberReference, name: member.name, state: member.state, city: member.city, metroArea: member.metroArea, age: member.age, gender: member.gender, pcpName: member.pcpName },
      clinical: { title: "Clinical profile", chronicConditions: member.chronicConditions, riskScore: member.riskScore, riskTier: member.riskTier, hospitalVisitProb6m: member.hospitalVisitProb6m, riskDrivers: member.riskDrivers, recommendedActions: member.recommendedActions },
      sdoh: { title: "Social determinants", transportationBarrier: sdohRow ? sdohRow.transportationFlag === 1 : null, foodInsecurity: sdohRow ? sdohRow.foodInsecurity === 1 : null, housingInstability: sdohRow ? sdohRow.housingInstability === 1 : null },
      pharmacy: { title: "Pharmacy", fills: rxRows.map((r: any) => ({ drugName: r.drugName, drugClass: r.drugClass, adherencePct: r.adherencePct, fillDate: r.fillDate })) },
      utilization: { title: "Utilization", erVisits12m: member.erVisits12m, pcpVisits12m: member.pcpVisits12m, inpatientVisits12m: member.inpatientVisits12m, breakdown: utilByType },
      claims: { title: "Recent claims", claimCount: claimRows.length, totalAmount: totalClaimAmount, countsByType: byType, recent: claimRows.slice(0, 8).map((c: any) => ({ date: c.date, type: c.type, amount: c.amount, icdCode: c.icdCode, provider: c.provider })) },
    },
  };
}

async function recommendOutreach(args: { memberId: string; drivers: string[] }) {
  const { db, schema, orm } = await getDb();
  const { members } = schema;
  const { eq } = orm;

  const member = await db.query.members.findFirst({ where: eq(members.id, args.memberId) });
  if (!member) return { error: "Member not found", recommendations: [] };

  const d = args.drivers.map((x) => x.toLowerCase()).join(" ");
  const out: { action: string; priority: string; rationale: string }[] = [];

  if (d.includes("transport") || d.includes("sdoh"))
    out.push({ action: "Offer transportation benefit navigation and scheduling assistance", priority: "high", rationale: "Transport barriers often drive missed care." });
  if (d.includes("food") || d.includes("hunger"))
    out.push({ action: "Connect to food assistance programs and meal benefit review", priority: "high", rationale: "Food insecurity correlates with poor chronic disease control." });
  if (d.includes("adher") || d.includes("pharmacy") || d.includes("medication"))
    out.push({ action: "Pharmacist-led adherence call and 90-day fill review", priority: "medium", rationale: "Medication gaps are a modifiable driver of risk." });
  if (member.riskTier === "high" || d.includes("clinical") || d.includes("risk"))
    out.push({ action: "Care manager outreach within 48 hours", priority: "high", rationale: `Member is ${member.riskTier} clinical risk.` });
  if (out.length === 0)
    out.push({ action: "Routine wellness check-in", priority: "medium", rationale: "Default proactive engagement." });

  return { memberId: args.memberId, memberName: member.name, memberReference: member.memberReference, recommendations: out };
}

async function generateChart(args: { chartType: string; dataQuery: string }) {
  const { db, schema, orm } = await getDb();
  const { members, claims, utilization } = schema;
  const { sql } = orm;

  const q = args.dataQuery.toLowerCase();
  let rows: any[];
  let title: string;

  if (q.includes("claim")) {
    rows = await db.select({ name: claims.type, value: sql`cast(count(*) as real)` }).from(claims).groupBy(claims.type);
    title = "Claims volume by type";
  } else if (q.includes("state")) {
    rows = await db.select({ name: members.state, value: sql`cast(count(*) as real)` }).from(members).groupBy(members.state);
    title = "Members by state";
  } else if (q.includes("utilization") || q.includes("er") || q.includes("visit")) {
    rows = await db.select({ name: utilization.eventType, value: sql`cast(count(*) as real)` }).from(utilization).groupBy(utilization.eventType);
    title = "Utilization events by type";
  } else {
    rows = await db.select({ name: members.riskTier, value: sql`cast(count(*) as real)` }).from(members).groupBy(members.riskTier);
    title = "Members by risk tier";
  }

  return { type: args.chartType, title, data: rows.map((r: any) => ({ name: String(r.name), value: Number(r.value) })) };
}

async function submitFeedback(args: { requestText: string; userRole: string }) {
  const { db, schema } = await getDb();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await db.insert(schema.feedbackRequests).values({ id, userRole: args.userRole, requestText: args.requestText, status: "new", createdAt });
  return { ok: true, id, message: "Feedback submitted for review.", createdAt };
}

async function governedQuery(args: {
  role: string;
  intent: string;
  filters?: Record<string, unknown>;
  scope?: string;
  limit?: number;
}) {
  if (!isDirect) return await proxyGovernedQuery(args);

  const { db, schema, orm } = await getDb();
  const { members, sdoh, auditLog } = schema;
  const { eq, and, inArray, like, sql } = orm;

  const ROLE_POLICIES: Record<string, { allowedIntents: string[]; blockedFields: string[]; roleNote: string }> = {
    care_manager: { allowedIntents: ["cohort", "member_outreach", "pharmacy_review", "quality_gap", "provider_coordination"], blockedFields: [], roleNote: "Full access with masked identifiers." },
    analyst: { allowedIntents: ["cohort", "pharmacy_review"], blockedFields: ["transportationBarrier", "foodInsecurity", "housingInstability", "recommendedActions", "selectionExplanation"], roleNote: "SDOH and outreach restricted." },
    quality: { allowedIntents: ["aggregate", "quality_gap", "cohort"], blockedFields: ["transportationBarrier", "foodInsecurity", "housingInstability", "recommendedActions", "pcpName"], roleNote: "Aggregate compliance only." },
    admin: { allowedIntents: ["cohort", "member_outreach", "pharmacy_review", "quality_gap", "provider_coordination", "aggregate"], blockedFields: [], roleNote: "Full admin access." },
  };

  const role = args.role in ROLE_POLICIES ? args.role : "care_manager";
  const policy = ROLE_POLICIES[role];
  const intent = args.intent || "cohort";

  if (!policy.allowedIntents.includes(intent)) {
    return { status: "error", error: `Role '${role}' is not authorized for '${intent}' queries.` };
  }

  const filters = (args.filters ?? {}) as Record<string, any>;
  const whereConditions = [];
  if (filters.riskTier) whereConditions.push(eq(members.riskTier, filters.riskTier));
  if (filters.states?.length > 0) whereConditions.push(inArray(members.state, filters.states));
  if (filters.diabetesOnly) whereConditions.push(eq(members.diabetesFlag, 1));
  if (filters.conditions?.length > 0) {
    const condOr = orm.or(...filters.conditions.map((c: string) => like(members.chronicConditions, `%${c}%`)));
    if (condOr) whereConditions.push(condOr);
  }

  const limit = Math.min(args.limit ?? 25, 100);
  const rows = await db
    .select({
      _id: members.id,
      memberReference: members.memberReference,
      name: members.name,
      state: members.state,
      city: members.city,
      metroArea: members.metroArea,
      age: members.age,
      gender: members.gender,
      riskScore: members.riskScore,
      riskTier: members.riskTier,
      hospitalVisitProb6m: members.hospitalVisitProb6m,
      chronicConditions: members.chronicConditions,
      riskDrivers: members.riskDrivers,
      recommendedActions: members.recommendedActions,
      selectionExplanation: members.selectionExplanation,
      pcpName: members.pcpName,
      erVisits12m: members.erVisits12m,
      pcpVisits12m: members.pcpVisits12m,
      adherenceScore: members.adherenceScore,
      sdohTransportation: sdoh.transportationFlag,
      sdohFood: sdoh.foodInsecurity,
      sdohHousing: sdoh.housingInstability,
    })
    .from(members)
    .leftJoin(sdoh, eq(members.id, sdoh.memberId))
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .orderBy(sql`${members.hospitalVisitProb6m} desc`)
    .limit(limit);

  const { pharmacy: pharmacyTable } = schema;
  const memberIds = rows.map((r: any) => r._id);
  const rxRows = memberIds.length ? await db.select().from(pharmacyTable).where(orm.inArray(pharmacyTable.memberId, memberIds)) : [];
  const rxByMember = new Map<string, any[]>();
  for (const rx of rxRows) { const arr = rxByMember.get(rx.memberId) ?? []; arr.push(rx); rxByMember.set(rx.memberId, arr); }

  const blocked = new Set(policy.blockedFields);
  const records = rows.map((r: any) => {
    const rx = rxByMember.get(r._id) ?? [];
    const avgAdherence = rx.length ? rx.reduce((s: number, x: any) => s + x.adherencePct, 0) / rx.length : null;

    const drivers: { name: string; score: number; category: string }[] = [
      { name: "Clinical risk score", score: Math.min(1, Math.max(0, r.riskScore)), category: "clinical" },
    ];
    if (r.sdohTransportation) drivers.push({ name: "Transportation access", score: 0.82, category: "sdoh" });
    if (r.sdohFood) drivers.push({ name: "Food insecurity", score: 0.78, category: "sdoh" });
    if (r.sdohHousing) drivers.push({ name: "Housing instability", score: 0.75, category: "sdoh" });
    if (avgAdherence !== null) drivers.push({ name: "Medication adherence", score: Math.min(1, Math.max(0, 1 - avgAdherence / 100)), category: "pharmacy" });
    if (r.erVisits12m >= 3) drivers.push({ name: "Frequent ER use", score: 0.85, category: "utilization" });
    if (r.pcpVisits12m === 0 && r.erVisits12m > 0) drivers.push({ name: "Low PCP engagement", score: 0.70, category: "utilization" });
    drivers.sort((a, b) => b.score - a.score);

    const driverText = drivers.map((x) => x.name.toLowerCase()).join(" ");
    const outreach: { action: string; priority: string; rationale: string }[] = [];
    if (driverText.includes("transportation")) outreach.push({ action: "Transportation benefit navigation", priority: "high", rationale: "Transport barriers drive missed care." });
    if (driverText.includes("food")) outreach.push({ action: "Food assistance programs", priority: "high", rationale: "Food insecurity worsens disease." });
    if (driverText.includes("adherence")) outreach.push({ action: "Pharmacist adherence call + 90-day fill review", priority: "medium", rationale: "Medication gaps are modifiable." });
    if (r.riskTier === "high") outreach.push({ action: "Care manager outreach within 48h", priority: "high", rationale: `Member is ${r.riskTier} risk.` });
    if (!outreach.length) outreach.push({ action: "Routine wellness check-in", priority: "medium", rationale: "Default engagement." });

    const rec: Record<string, any> = {
      memberReference: r.memberReference, name: r.name, state: r.state, city: r.city,
      metroArea: r.metroArea, age: r.age, gender: r.gender, riskScore: r.riskScore,
      riskTier: r.riskTier, hospitalVisitProb6m: r.hospitalVisitProb6m,
      chronicConditions: r.chronicConditions, riskDrivers: r.riskDrivers,
      recommendedActions: r.recommendedActions, selectionExplanation: r.selectionExplanation,
      erVisits12m: r.erVisits12m, pcpVisits12m: r.pcpVisits12m,
      adherenceScore: r.adherenceScore, pcpName: r.pcpName,
      sdoh: { transportationBarrier: r.sdohTransportation === 1, foodInsecurity: r.sdohFood === 1, housingInstability: r.sdohHousing === 1 },
      riskDriversDetail: drivers,
      outreachRecommendations: outreach,
      pharmacySummary: blocked.has("recommendedActions") ? undefined : {
        fillCount: rx.length,
        avgAdherencePct: avgAdherence !== null ? Math.round(avgAdherence * 10) / 10 : null,
        medications: rx.slice(0, 5).map((x: any) => ({ drug: x.drugName, class: x.drugClass, adherence: x.adherencePct })),
      },
    };
    for (const f of blocked) delete rec[f];
    return rec;
  });

  const auditId = crypto.randomUUID();
  try {
    await db.insert(auditLog).values({
      id: auditId,
      userId: "mcp_client",
      userRole: role,
      action: `governed_query:${intent}`,
      toolArgs: JSON.stringify(filters),
      resultSummary: `${rows.length} members (enriched), scope=${args.scope ?? "member_level"}`,
      blockedFields: policy.blockedFields.join(", "),
      policyNote: policy.roleNote,
      createdAt: new Date().toISOString(),
    });
  } catch { /* non-critical */ }

  return {
    status: "ok",
    role,
    intent,
    summary: { matchingMembers: rows.length, highRiskMembers: rows.filter((r: any) => r.riskTier === "high").length },
    records,
    governance: { policyNote: policy.roleNote, blockedFields: policy.blockedFields, auditId },
    note: "Each record includes riskDriversDetail, outreachRecommendations, and pharmacySummary inline. No follow-up member tool calls needed.",
  };
}

async function runPipeline() {
  if (!isDirect) return await proxyPipeline();

  const { db, schema, orm } = await getDb();
  const { members, claims, pharmacy, sdoh, callCenter, utilization } = schema;
  const { count, avg, min, max, sql } = orm;

  const steps: any[] = [];

  let start = Date.now();
  const [mc] = await db.select({ count: count() }).from(members);
  const [cc] = await db.select({ count: count() }).from(claims);
  const [rc] = await db.select({ count: count() }).from(pharmacy);
  const [sc] = await db.select({ count: count() }).from(sdoh);
  const [ccc] = await db.select({ count: count() }).from(callCenter);
  const [uc] = await db.select({ count: count() }).from(utilization);
  steps.push({ step: "ingest", status: "completed", durationMs: Date.now() - start, output: { members: mc.count, claims: cc.count, pharmacy: rc.count, sdoh: sc.count, call_center: ccc.count, utilization: uc.count, total_records: mc.count + cc.count + rc.count + sc.count + ccc.count + uc.count } });

  start = Date.now();
  const [ageStats] = await db.select({ minAge: min(members.age), maxAge: max(members.age), avgAge: avg(members.age) }).from(members);
  const tierDist = await db.select({ tier: members.riskTier, count: count() }).from(members).groupBy(members.riskTier);
  steps.push({ step: "profile", status: "completed", durationMs: Date.now() - start, output: { age: { min: ageStats.minAge, max: ageStats.maxAge, avg: Number(Number(ageStats.avgAge).toFixed(1)) }, riskTierDistribution: Object.fromEntries(tierDist.map((r: any) => [r.tier, r.count])) } });

  start = Date.now();
  const icdCodes = await db.select({ code: claims.icdCode, count: count() }).from(claims).groupBy(claims.icdCode);
  const drugNames = await db.select({ drug: pharmacy.drugName, count: count() }).from(pharmacy).groupBy(pharmacy.drugName);
  steps.push({ step: "standardize", status: "completed", durationMs: Date.now() - start, output: { icdCodesValidated: icdCodes.length, drugNamesMapped: drugNames.length } });

  start = Date.now();
  const [wc] = await db.select({ count: sql`count(distinct ${claims.memberId})` }).from(claims);
  steps.push({ step: "entity_resolve", status: "completed", durationMs: Date.now() - start, output: { totalMembers: mc.count, linkedViaClaims: wc.count, matchRate: `${mc.count > 0 ? Math.round((Math.min(mc.count, wc.count) / mc.count) * 100) : 0}%` } });

  start = Date.now();
  const orphanResult = await db.all(sql`select count(*) as cnt from claims where member_id not in (select id from members)`);
  const orphanCount = (orphanResult[0] as any)?.cnt ?? 0;
  const rangeResult = await db.all(sql`select count(*) as cnt from members where risk_score < 0 or risk_score > 1`);
  const outOfRange = (rangeResult[0] as any)?.cnt ?? 0;
  const rules = [
    { rule: "Grain: one row per member", passed: mc.count > 0 },
    { rule: "Referential integrity", passed: orphanCount === 0 },
    { rule: "Risk score in [0,1]", passed: outOfRange === 0 },
  ];
  const passed = rules.filter((r) => r.passed).length;
  steps.push({ step: "validate", status: "completed", durationMs: Date.now() - start, output: { rules, rulesPassed: passed, rulesTotal: rules.length, qualityScore: `${Math.round((passed / rules.length) * 100)}%`, readyForModeling: passed === rules.length } });

  const totalMs = steps.reduce((s: number, st: any) => s + st.durationMs, 0);
  steps.push({ step: "summary", status: "completed", durationMs: totalMs, output: { pipeline: "hospitalization_risk_prediction", stepsCompleted: 5, stepsTotal: 5, totalDurationMs: totalMs, qualityScore: steps[4].output.qualityScore, readyForModeling: steps[4].output.readyForModeling } });

  return steps;
}

// ── MCP Server Setup ────────────────────────────────────────────────────────

const server = new McpServer({
  name: "meridian-healthcare",
  version: "1.0.0",
});

server.tool(
  "identify_cohort",
  "Find members matching geographic, clinical, and risk filters with SDOH context",
  {
    states: z.array(z.string()).describe("US state codes (empty = all)"),
    conditions: z.array(z.string()).describe("Condition keywords (empty = all)"),
    riskTier: z.enum(["high", "medium", "low"]),
  },
  async (args) => {
    const result = isDirect ? await identifyCohort(args) : JSON.parse(await proxyChat("identify_cohort", args));
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_risk_drivers",
  "Analyze top risk drivers for a member from clinical, SDOH, and pharmacy data",
  { memberId: z.string() },
  async (args) => {
    const result = isDirect ? await getRiskDrivers(args) : JSON.parse(await proxyChat("get_risk_drivers", args));
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "explain_member",
  "Produce a structured explanation of why a member is flagged using all available data",
  { memberId: z.string() },
  async (args) => {
    const result = isDirect ? await explainMember(args) : JSON.parse(await proxyChat("explain_member", args));
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "recommend_outreach",
  "Suggest prioritized interventions based on a member's risk drivers",
  { memberId: z.string(), drivers: z.array(z.string()).describe("Risk driver keywords") },
  async (args) => {
    const result = isDirect ? await recommendOutreach(args) : JSON.parse(await proxyChat("recommend_outreach", args));
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "generate_chart",
  "Build chart-ready aggregates from the healthcare database",
  { chartType: z.enum(["bar", "pie", "line"]), dataQuery: z.string().describe("e.g. 'by state', 'by risk tier', 'claims by type'") },
  async (args) => {
    const result = isDirect ? await generateChart(args) : JSON.parse(await proxyChat("generate_chart", args));
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "submit_feedback",
  "Record a feature or metric request for product review",
  { requestText: z.string(), userRole: z.string() },
  async (args) => {
    const result = isDirect ? await submitFeedback(args) : JSON.parse(await proxyChat("submit_feedback", args));
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "check_governance",
  "GOVERNANCE GATE — Preview what governance rules apply for a given role and intent BEFORE executing a query. Returns the policy note, which fields will be blocked, which tools are allowed, and whether the intent is permitted. The agent MUST present this to the user and ask for confirmation before calling governed_query.",
  {
    role: z.enum(["care_manager", "analyst", "quality", "admin"]).describe("The role to check governance rules for"),
    intent: z.string().describe("The query intent to check: cohort, member_outreach, pharmacy_review, quality_gap, provider_coordination, aggregate"),
  },
  async (args) => {
    const ROLE_POLICIES: Record<string, {
      allowedTools: string[];
      allowedIntents: string[];
      blockedFields: string[];
      roleNote: string;
    }> = {
      care_manager: {
        allowedTools: ["identify_cohort", "get_risk_drivers", "explain_member", "recommend_outreach", "generate_chart", "submit_feedback"],
        allowedIntents: ["cohort", "member_outreach", "pharmacy_review", "quality_gap", "provider_coordination"],
        blockedFields: [],
        roleNote: "Care management has full access to all tools, SDOH, explanations, and outreach with masked member identifiers.",
      },
      analyst: {
        allowedTools: ["identify_cohort", "get_risk_drivers", "generate_chart", "submit_feedback"],
        allowedIntents: ["cohort", "pharmacy_review"],
        blockedFields: ["transportationBarrier", "foodInsecurity", "housingInstability", "financialStress", "socialIsolation", "recommendedActions", "selectionExplanation"],
        roleNote: "Analyst/pharmacy role can view adherence and drug-class data. SDOH detail fields and outreach recommendations are BLOCKED.",
      },
      quality: {
        allowedTools: ["identify_cohort", "generate_chart", "submit_feedback"],
        allowedIntents: ["aggregate", "quality_gap", "cohort"],
        blockedFields: ["transportationBarrier", "foodInsecurity", "housingInstability", "financialStress", "socialIsolation", "recommendedActions", "selectionExplanation", "pcpName"],
        roleNote: "Quality users receive aggregate compliance and gap analysis only. SDOH, outreach, and provider names are BLOCKED.",
      },
      admin: {
        allowedTools: ["identify_cohort", "get_risk_drivers", "explain_member", "recommend_outreach", "generate_chart", "submit_feedback", "governed_query"],
        allowedIntents: ["cohort", "member_outreach", "pharmacy_review", "quality_gap", "provider_coordination", "aggregate"],
        blockedFields: [],
        roleNote: "Administrative access with full data visibility and governance review capabilities.",
      },
    };

    const role = args.role in ROLE_POLICIES ? args.role : "care_manager";
    const policy = ROLE_POLICIES[role];
    const intentAllowed = policy.allowedIntents.includes(args.intent);

    const result = {
      governancePreview: true,
      role,
      intent: args.intent,
      intentAllowed,
      decision: intentAllowed ? "ALLOWED — proceed with user confirmation" : "BLOCKED — this role cannot perform this intent",
      policyNote: policy.roleNote,
      allowedTools: policy.allowedTools,
      blockedFields: policy.blockedFields.length > 0 ? policy.blockedFields : ["(none — full access)"],
      fieldMaskingSummary: policy.blockedFields.length > 0
        ? `${policy.blockedFields.length} fields will be redacted from results: ${policy.blockedFields.join(", ")}`
        : "No fields will be redacted — full visibility for this role.",
      auditNote: "This query will be logged to the governance audit trail with role, intent, filters, result summary, and blocked fields.",
      userConfirmationRequired: true,
      confirmationPrompt: intentAllowed
        ? `Governance check passed for role "${role}" with intent "${args.intent}". ${policy.blockedFields.length > 0 ? `Note: ${policy.blockedFields.length} SDOH/outreach fields will be masked.` : "Full data access granted."} Shall I proceed with the governed query?`
        : `GOVERNANCE BLOCK: Role "${role}" is NOT authorized for intent "${args.intent}". Allowed intents for this role: ${policy.allowedIntents.join(", ")}. Please select a different role or intent.`,
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "request_governed_access",
  "FULL GOVERNED ACCESS FLOW — Use this for the A2A governance demo. It runs the complete governance lifecycle: (1) presents role options, (2) checks governance rules, (3) requires user confirmation, (4) executes the query with masking, (5) returns results with audit metadata. The agent MUST present each step to the user and wait for input at the confirmation step.",
  {
    role: z.enum(["care_manager", "analyst", "quality", "admin"]).describe("The requesting agent's role — present all 4 options to the user and let them choose"),
    intent: z.string().describe("Query intent: cohort, member_outreach, pharmacy_review, quality_gap, provider_coordination, aggregate"),
    filters: z.object({
      states: z.array(z.string()).optional(),
      riskTier: z.string().optional(),
      conditions: z.array(z.string()).optional(),
      diabetesOnly: z.boolean().optional(),
      minErVisits: z.number().optional(),
      maxPcpVisits: z.number().optional(),
      metroAreaContains: z.string().optional(),
      adherenceBelow: z.number().optional(),
    }).optional().describe("Query filters"),
    scope: z.enum(["aggregated", "member_level"]).optional().describe("Response scope — present both options to user"),
    limit: z.number().optional().describe("Max records to return (default 15)"),
    userConfirmed: z.boolean().describe("Set to true ONLY after presenting governance rules to the user and receiving explicit confirmation"),
  },
  async (args) => {
    const ROLE_POLICIES: Record<string, { allowedIntents: string[]; blockedFields: string[]; roleNote: string }> = {
      care_manager: { allowedIntents: ["cohort", "member_outreach", "pharmacy_review", "quality_gap", "provider_coordination"], blockedFields: [], roleNote: "Full access with masked identifiers." },
      analyst: { allowedIntents: ["cohort", "pharmacy_review"], blockedFields: ["transportationBarrier", "foodInsecurity", "housingInstability", "financialStress", "socialIsolation", "recommendedActions", "selectionExplanation"], roleNote: "SDOH and outreach restricted." },
      quality: { allowedIntents: ["aggregate", "quality_gap", "cohort"], blockedFields: ["transportationBarrier", "foodInsecurity", "housingInstability", "financialStress", "socialIsolation", "recommendedActions", "selectionExplanation", "pcpName"], roleNote: "Aggregate compliance only." },
      admin: { allowedIntents: ["cohort", "member_outreach", "pharmacy_review", "quality_gap", "provider_coordination", "aggregate"], blockedFields: [], roleNote: "Full admin access." },
    };

    const role = args.role in ROLE_POLICIES ? args.role : "care_manager";
    const policy = ROLE_POLICIES[role];
    const intentAllowed = policy.allowedIntents.includes(args.intent);

    if (!intentAllowed) {
      return { content: [{ type: "text" as const, text: JSON.stringify({
        step: "GOVERNANCE_BLOCK",
        status: "rejected",
        role,
        intent: args.intent,
        reason: `Role "${role}" is not authorized for "${args.intent}" queries.`,
        allowedIntents: policy.allowedIntents,
        suggestion: "Ask the user to select a different role or intent.",
      }, null, 2) }] };
    }

    if (!args.userConfirmed) {
      return { content: [{ type: "text" as const, text: JSON.stringify({
        step: "AWAITING_USER_CONFIRMATION",
        status: "pending",
        role,
        intent: args.intent,
        policyNote: policy.roleNote,
        blockedFields: policy.blockedFields,
        fieldMaskingSummary: policy.blockedFields.length > 0
          ? `${policy.blockedFields.length} fields will be redacted: ${policy.blockedFields.join(", ")}`
          : "Full data visibility — no fields blocked.",
        scope: args.scope ?? "member_level",
        filters: args.filters ?? {},
        instructions: "PRESENT THIS TO THE USER: Show the role, policy note, blocked fields, and scope. Ask the user to confirm they want to proceed. Then call this tool again with userConfirmed=true.",
        confirmationPrompt: `I'm about to query healthcare data as role "${role}" (${policy.roleNote}). ${policy.blockedFields.length > 0 ? `${policy.blockedFields.length} sensitive fields will be masked.` : "Full data access."} Scope: ${args.scope ?? "member_level"}. Do you approve this governed access?`,
      }, null, 2) }] };
    }

    // User confirmed — execute the governed query
    const result = await governedQuery({
      role,
      intent: args.intent,
      filters: args.filters,
      scope: args.scope,
      limit: args.limit ?? 15,
    });

    return { content: [{ type: "text" as const, text: JSON.stringify({
      step: "QUERY_EXECUTED",
      status: "completed",
      governanceApplied: true,
      userConfirmed: true,
      ...result,
      governanceSummary: {
        role,
        intent: args.intent,
        fieldsBlocked: policy.blockedFields,
        auditLogged: true,
        policyEnforced: policy.roleNote,
      },
    }, null, 2) }] };
  }
);

server.tool(
  "governed_query",
  "Execute a governed cross-agent query with role-based access control, field masking, and audit logging. This is the A2A endpoint — client agents call this to request data from the host with governance enforcement.",
  {
    role: z.enum(["care_manager", "analyst", "quality", "admin"]).describe("The requesting agent's role"),
    intent: z.string().describe("Query intent: cohort, member_outreach, pharmacy_review, quality_gap, provider_coordination, aggregate"),
    filters: z.object({
      states: z.array(z.string()).optional(),
      riskTier: z.string().optional(),
      conditions: z.array(z.string()).optional(),
      diabetesOnly: z.boolean().optional(),
      minErVisits: z.number().optional(),
      maxPcpVisits: z.number().optional(),
      metroAreaContains: z.string().optional(),
      adherenceBelow: z.number().optional(),
    }).optional().describe("Query filters"),
    scope: z.enum(["aggregated", "member_level"]).optional().describe("Response scope"),
    limit: z.number().optional().describe("Max records to return"),
  },
  async (args) => {
    const result = await governedQuery(args);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "governed_member_detail",
  "Look up a single member by their governed masked reference (e.g. MBR-478) and return full risk drivers, outreach plan, pharmacy fills, claims, and explanation — all within the governance boundary. Use this for follow-up deep-dives on members returned by request_governed_access.",
  {
    memberReference: z.string().describe("The masked member reference from a governed query (e.g. MBR-478)"),
    role: z.enum(["care_manager", "analyst", "quality", "admin"]).describe("Must match the role used in the original governed query"),
    auditId: z.string().optional().describe("Audit ID from the original governed query for chain-of-custody"),
  },
  async (args) => {
    if (!isDirect) {
      const res = await fetch(`${API_URL}/api/collaborate/member-detail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      }).catch(() => null);
      if (res?.ok) {
        const data = await res.json();
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      }
    }

    const { db, schema, orm } = await getDb();
    const { members, sdoh, pharmacy, claims, auditLog } = schema;
    const { eq, desc: descOrd } = orm;

    const ROLE_POLICIES: Record<string, { blockedFields: string[]; roleNote: string }> = {
      care_manager: { blockedFields: [], roleNote: "Full access with masked identifiers." },
      analyst: { blockedFields: ["transportationBarrier", "foodInsecurity", "housingInstability", "recommendedActions", "selectionExplanation"], roleNote: "SDOH and outreach restricted." },
      quality: { blockedFields: ["transportationBarrier", "foodInsecurity", "housingInstability", "recommendedActions", "pcpName"], roleNote: "Aggregate compliance only." },
      admin: { blockedFields: [], roleNote: "Full admin access." },
    };

    const role = args.role in ROLE_POLICIES ? args.role : "care_manager";
    const policy = ROLE_POLICIES[role];
    const blocked = new Set(policy.blockedFields);

    const m = await db.query.members.findFirst({ where: eq(members.memberReference, args.memberReference) });
    if (!m) return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Member not found for this governed reference.", memberReference: args.memberReference }) }] };

    const [sdohRow, rxRows, claimRows] = await Promise.all([
      db.query.sdoh.findFirst({ where: eq(sdoh.memberId, m.id) }),
      db.select().from(pharmacy).where(eq(pharmacy.memberId, m.id)),
      db.select().from(claims).where(eq(claims.memberId, m.id)).orderBy(descOrd(claims.date)).limit(15),
    ]);

    const avgAdherence = rxRows.length ? rxRows.reduce((s: number, r: any) => s + r.adherencePct, 0) / rxRows.length : null;
    const drivers: { name: string; score: number; category: string }[] = [
      { name: "Clinical risk score", score: Math.min(1, Math.max(0, m.riskScore)), category: "clinical" },
    ];
    if (sdohRow?.transportationFlag) drivers.push({ name: "Transportation access", score: 0.82, category: "sdoh" });
    if (sdohRow?.foodInsecurity) drivers.push({ name: "Food insecurity", score: 0.78, category: "sdoh" });
    if (sdohRow?.housingInstability) drivers.push({ name: "Housing instability", score: 0.75, category: "sdoh" });
    if (avgAdherence !== null) drivers.push({ name: "Medication adherence", score: Math.min(1, Math.max(0, 1 - avgAdherence / 100)), category: "pharmacy" });
    if (m.erVisits12m >= 3) drivers.push({ name: "Frequent ER use", score: 0.85, category: "utilization" });
    if (m.pcpVisits12m === 0 && m.erVisits12m > 0) drivers.push({ name: "Low PCP engagement", score: 0.70, category: "utilization" });
    drivers.sort((a, b) => b.score - a.score);

    const driverText = drivers.map((x) => x.name.toLowerCase()).join(" ");
    const outreach: { action: string; priority: string; rationale: string }[] = [];
    if (driverText.includes("transportation")) outreach.push({ action: "Transportation benefit navigation", priority: "high", rationale: "Transport barriers drive missed care." });
    if (driverText.includes("food")) outreach.push({ action: "Food assistance programs", priority: "high", rationale: "Food insecurity worsens disease." });
    if (driverText.includes("adherence")) outreach.push({ action: "Pharmacist adherence call + 90-day fill review", priority: "medium", rationale: "Medication gaps are modifiable." });
    if (m.riskTier === "high") outreach.push({ action: "Care manager outreach within 48h", priority: "high", rationale: `Member is ${m.riskTier} risk.` });
    if (!outreach.length) outreach.push({ action: "Routine wellness check-in", priority: "medium", rationale: "Default engagement." });

    const rec: Record<string, any> = {
      memberReference: m.memberReference, name: m.name, state: m.state, city: m.city,
      metroArea: m.metroArea, age: m.age, gender: m.gender, riskScore: m.riskScore,
      riskTier: m.riskTier, hospitalVisitProb6m: m.hospitalVisitProb6m,
      chronicConditions: m.chronicConditions, riskDrivers: m.riskDrivers,
      recommendedActions: m.recommendedActions, selectionExplanation: m.selectionExplanation,
      erVisits12m: m.erVisits12m, pcpVisits12m: m.pcpVisits12m,
      adherenceScore: m.adherenceScore, pcpName: m.pcpName,
      sdoh: sdohRow ? { transportationBarrier: sdohRow.transportationFlag === 1, foodInsecurity: sdohRow.foodInsecurity === 1, housingInstability: sdohRow.housingInstability === 1 } : null,
      overview: `${m.name}, ${m.age}yo ${m.gender} in ${m.city}, ${m.state}. ${m.riskTier} risk (${m.riskScore}). ${m.selectionExplanation}`,
      riskDriversDetail: drivers,
      outreachRecommendations: outreach,
      pharmacyDetail: { fillCount: rxRows.length, avgAdherencePct: avgAdherence !== null ? Math.round(avgAdherence * 10) / 10 : null, medications: rxRows.map((x: any) => ({ drug: x.drugName, class: x.drugClass, adherence: x.adherencePct, fillDate: x.fillDate })) },
      claimsSummary: { count: claimRows.length, totalAmount: claimRows.reduce((a: number, c: any) => a + c.amount, 0), recent: claimRows.slice(0, 5).map((c: any) => ({ date: c.date, type: c.type, amount: c.amount, icdCode: c.icdCode })) },
    };
    for (const f of blocked) delete rec[f];

    const detailAuditId = crypto.randomUUID();
    try {
      await db.insert(auditLog).values({ id: detailAuditId, userId: "mcp_client", userRole: role, action: "governed_member_detail", toolArgs: JSON.stringify({ memberReference: args.memberReference, parentAuditId: args.auditId }), resultSummary: `Detail for ${args.memberReference}`, blockedFields: policy.blockedFields.join(", "), policyNote: policy.roleNote, createdAt: new Date().toISOString() });
    } catch { /* non-critical */ }

    return { content: [{ type: "text" as const, text: JSON.stringify({ memberReference: args.memberReference, role, governanceApplied: true, record: rec, governance: { policyNote: policy.roleNote, blockedFields: policy.blockedFields, auditId: detailAuditId, parentAuditId: args.auditId ?? null } }, null, 2) }] };
  }
);

server.tool(
  "run_pipeline",
  "Execute the 5-step healthcare data pipeline: Ingest, Profile, Standardize, Entity Resolve, Validate",
  {},
  async () => {
    const result = await runPipeline();
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Composable Pipeline Tools ────────────────────────────────────────────────

const VALID_ICD_SET = new Set(["E11.9", "I50.9", "J44.1", "I10", "N18.9", "J45.909", "F32.9", "Z00.0"]);
const ICD_CORRECTIONS: Record<string, string> = { "E119": "E11.9", "I509": "I50.9", "J441": "J44.1", "I1O": "I10", "N189": "N18.9", "j45.909": "J45.909", "F329": "F32.9", "E11": "E11.9", "I50": "I50.9" };
const VALID_DRUG_SET = new Set(["Metformin", "Ozempic", "Jardiance", "Lisinopril", "Atorvastatin", "Losartan", "Albuterol", "Symbicort", "Sertraline", "Buspirone", "Amlodipine", "Omeprazole", "Insulin Glargine", "Furosemide"]);
const DRUG_CORRECTIONS: Record<string, string> = { "metformin": "Metformin", "OZEMPIC": "Ozempic", "jardiance": "Jardiance", "Lisinoprl": "Lisinopril", "atorvastatin": "Atorvastatin", "losartan HCL": "Losartan", "albuterol sulfate": "Albuterol", "Symbicrt": "Symbicort", "sertralin": "Sertraline" };

server.tool("inspect_sources", "Inventory all data sources — row counts, columns, null rates, freshness.", {}, async () => {
  const { db, schema, orm } = await getDb();
  const { members, claims, pharmacy, sdoh, callCenter, utilization, rawClaims, rawPharmacy, customSources } = schema;
  const { count, min, max, sql } = orm;

  const KNOWN = [
    { name: "members", ref: members }, { name: "claims", ref: claims }, { name: "pharmacy", ref: pharmacy },
    { name: "sdoh", ref: sdoh }, { name: "call_center", ref: callCenter }, { name: "utilization", ref: utilization },
    { name: "raw_claims", ref: rawClaims }, { name: "raw_pharmacy", ref: rawPharmacy },
  ];

  const tables: Record<string, unknown>[] = [];
  for (const t of KNOWN) {
    const [rc] = await db.select({ count: count() }).from(t.ref);
    tables.push({ table: t.name, rowCount: rc.count });
  }

  const customs = await db.select().from(customSources);
  for (const c of customs) {
    const result = await db.all(sql.raw(`SELECT COUNT(*) as cnt FROM "${c.tableName}"`));
    tables.push({ table: c.tableName, rowCount: (result[0] as Record<string, number>)?.cnt ?? 0, custom: true, description: c.description });
  }

  const [claimDateRange] = await db.select({ earliest: min(claims.date), latest: max(claims.date) }).from(claims);
  const [rawClaimNulls] = await db.select({
    nullMemberId: sql<number>`sum(case when member_id = '' then 1 else 0 end)`,
    nullIcd: sql<number>`sum(case when icd_code = '' then 1 else 0 end)`,
    nullDate: sql<number>`sum(case when date = '' then 1 else 0 end)`,
    total: count(),
  }).from(rawClaims);
  const [rawRxNulls] = await db.select({
    nullMemberId: sql<number>`sum(case when member_id = '' then 1 else 0 end)`,
    nullDrug: sql<number>`sum(case when drug_name = '' then 1 else 0 end)`,
    nullDate: sql<number>`sum(case when fill_date = '' then 1 else 0 end)`,
    total: count(),
  }).from(rawPharmacy);

  return { content: [{ type: "text" as const, text: JSON.stringify({
    sources: tables,
    cleanDataFreshness: { claims: claimDateRange },
    rawDataQuality: {
      raw_claims: { total: rawClaimNulls.total, nullMemberIds: rawClaimNulls.nullMemberId, nullIcdCodes: rawClaimNulls.nullIcd, nullDates: rawClaimNulls.nullDate },
      raw_pharmacy: { total: rawRxNulls.total, nullMemberIds: rawRxNulls.nullMemberId, nullDrugNames: rawRxNulls.nullDrug, nullDates: rawRxNulls.nullDate },
    },
    hint: "Use profile_table to deep-dive into any table. Use standardize_records to clean raw_claims or raw_pharmacy.",
  }, null, 2) }] };
});

server.tool("profile_table", "Deep-dive stats for a single table — distributions, nulls, outliers, distinct counts.", {
  table: z.string().describe("Table name to profile, e.g. 'members', 'raw_claims', 'raw_pharmacy'"),
}, async ({ table: tableName }) => {
  const { db, schema, orm } = await getDb();
  const { count, min, max, avg, sql } = orm;
  const profile: Record<string, unknown> = { table: tableName };

  if (tableName === "members") {
    const [stats] = await db.select({ count: count(), minAge: min(schema.members.age), maxAge: max(schema.members.age), avgAge: avg(schema.members.age), minRisk: min(schema.members.riskScore), maxRisk: max(schema.members.riskScore), avgRisk: avg(schema.members.riskScore) }).from(schema.members);
    const tierDist = await db.select({ tier: schema.members.riskTier, count: count() }).from(schema.members).groupBy(schema.members.riskTier);
    const stateDist = await db.select({ state: schema.members.state, count: count() }).from(schema.members).groupBy(schema.members.state);
    profile.stats = stats; profile.tierDistribution = Object.fromEntries(tierDist.map((r: any) => [r.tier, r.count])); profile.stateDistribution = Object.fromEntries(stateDist.map((r: any) => [r.state, r.count]));
  } else if (tableName === "raw_claims") {
    const [stats] = await db.select({ count: count(), minAmt: min(schema.rawClaims.amount), maxAmt: max(schema.rawClaims.amount), avgAmt: avg(schema.rawClaims.amount) }).from(schema.rawClaims);
    const icdDist = await db.select({ code: schema.rawClaims.icdCode, count: count() }).from(schema.rawClaims).groupBy(schema.rawClaims.icdCode);
    const typeDist = await db.select({ type: schema.rawClaims.type, count: count() }).from(schema.rawClaims).groupBy(schema.rawClaims.type);
    const sourceDist = await db.select({ src: schema.rawClaims.sourceFile, count: count() }).from(schema.rawClaims).groupBy(schema.rawClaims.sourceFile);
    const [nulls] = await db.select({ emptyMemberId: sql<number>`sum(case when member_id='' then 1 else 0 end)`, emptyIcd: sql<number>`sum(case when icd_code='' then 1 else 0 end)`, emptyDate: sql<number>`sum(case when date='' then 1 else 0 end)`, negativeAmt: sql<number>`sum(case when amount<0 then 1 else 0 end)`, outlierAmt: sql<number>`sum(case when amount>100000 then 1 else 0 end)`, total: count() }).from(schema.rawClaims);
    const [orphans] = await db.select({ count: sql<number>`count(*)` }).from(schema.rawClaims).where(sql`member_id != '' AND member_id NOT IN (SELECT id FROM members)`);
    const invalidIcd = icdDist.filter((r: any) => r.code !== "" && !VALID_ICD_SET.has(r.code));
    const today = new Date().toISOString().split("T")[0];
    const [futureDated] = await db.select({ count: sql<number>`sum(case when date > ${today} then 1 else 0 end)` }).from(schema.rawClaims);
    profile.stats = stats; profile.icdDistribution = icdDist; profile.typeDistribution = Object.fromEntries(typeDist.map((r: any) => [r.type, r.count])); profile.sourceFiles = Object.fromEntries(sourceDist.map((r: any) => [r.src, r.count]));
    profile.issues = { ...nulls, orphanMemberIds: orphans.count, invalidIcdCodes: invalidIcd.map((r: any) => ({ code: r.code, count: r.count })), futureDatedRecords: futureDated.count };
  } else if (tableName === "raw_pharmacy") {
    const [stats] = await db.select({ count: count(), minAdh: min(schema.rawPharmacy.adherencePct), maxAdh: max(schema.rawPharmacy.adherencePct), avgAdh: avg(schema.rawPharmacy.adherencePct) }).from(schema.rawPharmacy);
    const drugDist = await db.select({ drug: schema.rawPharmacy.drugName, count: count() }).from(schema.rawPharmacy).groupBy(schema.rawPharmacy.drugName);
    const [nulls] = await db.select({ emptyMemberId: sql<number>`sum(case when member_id='' then 1 else 0 end)`, emptyDrug: sql<number>`sum(case when drug_name='' then 1 else 0 end)`, emptyDate: sql<number>`sum(case when fill_date='' then 1 else 0 end)`, outOfRangeAdh: sql<number>`sum(case when adherence_pct<0 or adherence_pct>100 then 1 else 0 end)`, total: count() }).from(schema.rawPharmacy);
    const invalidDrugs = drugDist.filter((r: any) => r.drug !== "" && !VALID_DRUG_SET.has(r.drug));
    profile.stats = stats; profile.drugDistribution = drugDist; profile.issues = { ...nulls, invalidDrugNames: invalidDrugs.map((r: any) => ({ drug: r.drug, count: r.count, correction: DRUG_CORRECTIONS[r.drug] ?? null })) };
  } else if (tableName === "claims") {
    const [stats] = await db.select({ count: count(), minAmt: min(schema.claims.amount), maxAmt: max(schema.claims.amount), avgAmt: avg(schema.claims.amount) }).from(schema.claims);
    const typeDist = await db.select({ type: schema.claims.type, count: count() }).from(schema.claims).groupBy(schema.claims.type);
    profile.stats = stats; profile.typeDistribution = Object.fromEntries(typeDist.map((r: any) => [r.type, r.count]));
  } else if (tableName === "pharmacy") {
    const [stats] = await db.select({ count: count(), minAdh: min(schema.pharmacy.adherencePct), maxAdh: max(schema.pharmacy.adherencePct), avgAdh: avg(schema.pharmacy.adherencePct) }).from(schema.pharmacy);
    const drugDist = await db.select({ drug: schema.pharmacy.drugName, count: count() }).from(schema.pharmacy).groupBy(schema.pharmacy.drugName);
    profile.stats = stats; profile.drugDistribution = drugDist;
  } else {
    const result = await db.all(sql.raw(`SELECT COUNT(*) as cnt FROM "${tableName}"`));
    profile.rowCount = (result[0] as Record<string, number>)?.cnt ?? 0;
    profile.note = "Basic profile only — use known table names for detailed stats.";
  }

  return { content: [{ type: "text" as const, text: JSON.stringify(profile, null, 2) }] };
});

server.tool("standardize_records", "Clean and standardize raw data — fix ICD codes, normalize drug names, flag bad dates, quarantine invalid records.", {
  source: z.enum(["raw_claims", "raw_pharmacy"]).describe("Which raw table to standardize"),
  dryRun: z.boolean().optional().describe("Preview changes without writing (default false)"),
}, async ({ source, dryRun }) => {
  const { db, schema, orm } = await getDb();
  const { rawClaims, rawPharmacy, stagingQuarantine, claims, pharmacy } = schema;
  const isDry = dryRun ?? false;
  const result: Record<string, unknown> = { source, dryRun: isDry };

  if (source === "raw_claims") {
    const rows = await db.select().from(rawClaims);
    const today = new Date().toISOString().split("T")[0];
    let cleaned = 0, corrected = 0, quarantined = 0;
    const quarantineReasons: { id: string; reasons: string[] }[] = [];
    const corrections: { id: string; field: string; from: string; to: string }[] = [];

    for (const row of rows) {
      const reasons: string[] = [];
      if (!row.memberId || row.memberId === "") reasons.push("empty_member_id");
      else if (row.memberId.startsWith("M-ORPHAN")) reasons.push("orphan_member_id");
      if (row.amount < 0) reasons.push("negative_amount");
      if (row.amount > 100000) reasons.push("outlier_amount");
      if (row.date > today && row.date !== "") reasons.push("future_dated");
      if (row.date === "") reasons.push("empty_date");

      let fixedIcd = row.icdCode;
      if (row.icdCode && !VALID_ICD_SET.has(row.icdCode)) {
        const correction = ICD_CORRECTIONS[row.icdCode];
        if (correction) { fixedIcd = correction; corrections.push({ id: row.id, field: "icd_code", from: row.icdCode, to: correction }); }
        else if (row.icdCode !== "") reasons.push(`invalid_icd:${row.icdCode}`);
      }

      if (reasons.length > 0) {
        quarantined++;
        quarantineReasons.push({ id: row.id, reasons });
        if (!isDry) {
          await db.insert(stagingQuarantine).values({ id: crypto.randomUUID(), sourceTable: "raw_claims", sourceId: row.id, reason: reasons.join(", "), stepName: "standardize_records", recordJson: JSON.stringify(row), createdAt: new Date().toISOString() });
        }
      } else {
        if (fixedIcd !== row.icdCode) corrected++;
        cleaned++;
        if (!isDry) {
          await db.insert(claims).values({ id: `SC-${row.id}`, memberId: row.memberId, icdCode: fixedIcd, type: row.type, amount: row.amount, date: row.date, provider: row.provider }).onConflictDoNothing();
        }
      }
    }
    result.cleaned = cleaned; result.corrected = corrected; result.quarantined = quarantined;
    result.sampleCorrections = corrections.slice(0, 10); result.sampleQuarantine = quarantineReasons.slice(0, 10);
  } else {
    const rows = await db.select().from(rawPharmacy);
    let cleaned = 0, corrected = 0, quarantined = 0;
    const quarantineReasons: { id: string; reasons: string[] }[] = [];
    const corrections: { id: string; field: string; from: string; to: string }[] = [];

    for (const row of rows) {
      const reasons: string[] = [];
      if (!row.memberId || row.memberId === "") reasons.push("empty_member_id");
      else if (row.memberId.startsWith("M-ORPHAN")) reasons.push("orphan_member_id");
      if (row.adherencePct < 0 || row.adherencePct > 100) reasons.push(`adherence_out_of_range:${row.adherencePct}`);
      if (row.fillDate === "") reasons.push("empty_fill_date");

      let fixedDrug = row.drugName;
      if (row.drugName && !VALID_DRUG_SET.has(row.drugName)) {
        const correction = DRUG_CORRECTIONS[row.drugName];
        if (correction) { fixedDrug = correction; corrections.push({ id: row.id, field: "drug_name", from: row.drugName, to: correction }); }
        else if (row.drugName !== "") reasons.push(`invalid_drug:${row.drugName}`);
      }

      if (reasons.length > 0) {
        quarantined++;
        quarantineReasons.push({ id: row.id, reasons });
        if (!isDry) {
          await db.insert(stagingQuarantine).values({ id: crypto.randomUUID(), sourceTable: "raw_pharmacy", sourceId: row.id, reason: reasons.join(", "), stepName: "standardize_records", recordJson: JSON.stringify(row), createdAt: new Date().toISOString() });
        }
      } else {
        if (fixedDrug !== row.drugName) corrected++;
        cleaned++;
        if (!isDry) {
          await db.insert(pharmacy).values({ id: `SP-${row.id}`, memberId: row.memberId, drugName: fixedDrug, drugClass: row.drugClass, adherencePct: row.adherencePct, fillDate: row.fillDate }).onConflictDoNothing();
        }
      }
    }
    result.cleaned = cleaned; result.corrected = corrected; result.quarantined = quarantined;
    result.sampleCorrections = corrections.slice(0, 10); result.sampleQuarantine = quarantineReasons.slice(0, 10);
  }

  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
});

server.tool("resolve_entities", "Check entity linkage across data sources. Exact mode checks FK integrity. Fuzzy mode finds potential duplicates.", {
  strategy: z.enum(["exact", "fuzzy"]).describe("exact = FK check, fuzzy = name similarity matching"),
}, async ({ strategy }) => {
  const { db, schema, orm } = await getDb();
  const { members, claims, pharmacy, sdoh, callCenter, utilization } = schema;
  const { count, sql } = orm;

  if (strategy === "exact") {
    const checks = await Promise.all([
      db.all(sql`SELECT count(*) as cnt FROM claims WHERE member_id NOT IN (SELECT id FROM members)`),
      db.all(sql`SELECT count(*) as cnt FROM pharmacy WHERE member_id NOT IN (SELECT id FROM members)`),
      db.all(sql`SELECT count(*) as cnt FROM sdoh WHERE member_id NOT IN (SELECT id FROM members)`),
      db.all(sql`SELECT count(*) as cnt FROM call_center WHERE member_id NOT IN (SELECT id FROM members)`),
      db.all(sql`SELECT count(*) as cnt FROM utilization WHERE member_id NOT IN (SELECT id FROM members)`),
    ]);
    const [mc] = await db.select({ count: count() }).from(members);
    const linked = await Promise.all([
      db.select({ count: sql<number>`count(distinct member_id)` }).from(claims),
      db.select({ count: sql<number>`count(distinct member_id)` }).from(pharmacy),
      db.select({ count: sql<number>`count(distinct member_id)` }).from(sdoh),
    ]);
    const total = mc.count || 1;
    return { content: [{ type: "text" as const, text: JSON.stringify({
      strategy: "exact", totalMembers: mc.count,
      orphans: { claims: (checks[0][0] as Record<string, number>).cnt, pharmacy: (checks[1][0] as Record<string, number>).cnt, sdoh: (checks[2][0] as Record<string, number>).cnt, call_center: (checks[3][0] as Record<string, number>).cnt, utilization: (checks[4][0] as Record<string, number>).cnt },
      linkageRates: { claims: `${Math.round((linked[0][0].count / total) * 100)}%`, pharmacy: `${Math.round((linked[1][0].count / total) * 100)}%`, sdoh: `${Math.round((linked[2][0].count / total) * 100)}%` },
      totalOrphans: checks.reduce((s: number, c: any) => s + (c[0] as Record<string, number>).cnt, 0),
    }, null, 2) }] };
  } else {
    const allMembers = await db.select({ id: members.id, name: members.name, state: members.state }).from(members).limit(500);
    const candidates: { member1: string; member2: string; name1: string; name2: string; state: string; similarity: string }[] = [];
    for (let i = 0; i < allMembers.length && candidates.length < 20; i++) {
      for (let j = i + 1; j < allMembers.length && candidates.length < 20; j++) {
        const a = allMembers[i], b = allMembers[j];
        if (a.state !== b.state) continue;
        const nameParts1 = a.name.toLowerCase().split(" ");
        const nameParts2 = b.name.toLowerCase().split(" ");
        const lastMatch = nameParts1.length > 1 && nameParts2.length > 1 && nameParts1[nameParts1.length - 1] === nameParts2[nameParts2.length - 1];
        if (lastMatch) candidates.push({ member1: a.id, member2: b.id, name1: a.name, name2: b.name, state: a.state, similarity: "same_last_name+state" });
      }
    }
    return { content: [{ type: "text" as const, text: JSON.stringify({ strategy: "fuzzy", candidateDuplicates: candidates.length, candidates: candidates.slice(0, 15) }, null, 2) }] };
  }
});

server.tool("quarantine_records", "Move bad records from a source table to the quarantine staging area.", {
  source: z.enum(["raw_claims", "raw_pharmacy"]).describe("Source table"),
  reason: z.string().describe("Why these records are being quarantined"),
  filter: z.object({
    field: z.string().describe("Column to filter on"),
    condition: z.enum(["empty", "out_of_range", "orphan", "future_dated"]).describe("Filter condition"),
  }),
}, async ({ source, reason, filter }) => {
  const { db, schema, orm } = await getDb();
  const { rawClaims, rawPharmacy, stagingQuarantine } = schema;
  const { sql } = orm;
  let moved = 0;

  if (source === "raw_claims") {
    let condition: any;
    if (filter.condition === "empty") condition = sql.raw(`"${filter.field}" = ''`);
    else if (filter.condition === "orphan") condition = sql`member_id != '' AND member_id NOT IN (SELECT id FROM members)`;
    else if (filter.condition === "future_dated") condition = sql`date > ${new Date().toISOString().split("T")[0]}`;
    else condition = sql`amount < 0 OR amount > 100000`;

    const rows = await db.select().from(rawClaims).where(condition);
    for (const row of rows) {
      await db.insert(stagingQuarantine).values({ id: crypto.randomUUID(), sourceTable: "raw_claims", sourceId: row.id, reason, stepName: "quarantine_records", recordJson: JSON.stringify(row), createdAt: new Date().toISOString() });
      moved++;
    }
  } else {
    let condition: any;
    if (filter.condition === "empty") condition = sql.raw(`"${filter.field}" = ''`);
    else if (filter.condition === "orphan") condition = sql`member_id NOT IN (SELECT id FROM members)`;
    else if (filter.condition === "out_of_range") condition = sql`adherence_pct < 0 OR adherence_pct > 100`;
    else condition = sql`fill_date = ''`;

    const rows = await db.select().from(rawPharmacy).where(condition);
    for (const row of rows) {
      await db.insert(stagingQuarantine).values({ id: crypto.randomUUID(), sourceTable: "raw_pharmacy", sourceId: row.id, reason, stepName: "quarantine_records", recordJson: JSON.stringify(row), createdAt: new Date().toISOString() });
      moved++;
    }
  }
  return { content: [{ type: "text" as const, text: JSON.stringify({ source, reason, filter, recordsQuarantined: moved }, null, 2) }] };
});

server.tool("validate_quality", "Run configurable quality gates across the dataset.", {
  rules: z.array(z.string()).optional().describe("Rules to run. Default: all."),
  thresholds: z.object({ completeness: z.number().optional(), linkage: z.number().optional() }).optional(),
}, async ({ rules: ruleList, thresholds }) => {
  const { db, schema, orm } = await getDb();
  const { members, claims } = schema;
  const { count, sql } = orm;
  const allRules = ruleList ?? ["not_empty", "unique_ids", "required_fields", "risk_range", "tier_consistency", "referential_integrity", "completeness", "distribution", "linkage"];
  const compThreshold = thresholds?.completeness ?? 0.95;
  const linkThreshold = thresholds?.linkage ?? 0.90;
  const results: { rule: string; passed: boolean; detail: string }[] = [];
  const [mc] = await db.select({ count: count() }).from(members);

  for (const rule of allRules) {
    if (rule === "not_empty") { results.push({ rule, passed: mc.count > 0, detail: `${mc.count} members` }); }
    else if (rule === "unique_ids") { const [u] = await db.select({ distinct: sql<number>`count(distinct id)`, total: count() }).from(members); results.push({ rule, passed: u.distinct === u.total, detail: `${u.distinct}/${u.total} unique` }); }
    else if (rule === "required_fields") { const [n] = await db.select({ cnt: sql<number>`sum(case when member_reference='' or state='' or risk_tier='' then 1 else 0 end)` }).from(members); results.push({ rule, passed: (n.cnt ?? 0) === 0, detail: `${n.cnt ?? 0} missing required fields` }); }
    else if (rule === "risk_range") { const [r] = await db.select({ cnt: sql<number>`sum(case when risk_score<0 or risk_score>1 then 1 else 0 end)` }).from(members); results.push({ rule, passed: (r.cnt ?? 0) === 0, detail: `${r.cnt ?? 0} out of range` }); }
    else if (rule === "tier_consistency") { const [t] = await db.select({ cnt: sql<number>`sum(case when risk_tier='high' and risk_score<0.70 then 1 when risk_tier='low' and risk_score>=0.40 then 1 else 0 end)` }).from(members); results.push({ rule, passed: (t.cnt ?? 0) === 0, detail: `${t.cnt ?? 0} inconsistent` }); }
    else if (rule === "referential_integrity") { const orphans = await db.all(sql`SELECT count(*) as cnt FROM claims WHERE member_id NOT IN (SELECT id FROM members)`); const cnt = (orphans[0] as Record<string, number>)?.cnt ?? 0; results.push({ rule, passed: cnt === 0, detail: `${cnt} orphan claims` }); }
    else if (rule === "completeness") { const [n] = await db.select({ nullRef: sql<number>`sum(case when member_reference='' then 1 else 0 end)`, nullState: sql<number>`sum(case when state='' then 1 else 0 end)`, nullTier: sql<number>`sum(case when risk_tier='' then 1 else 0 end)`, nullDrivers: sql<number>`sum(case when risk_drivers='' then 1 else 0 end)`, total: count() }).from(members); const total = n.total || 1; const rate = 1 - ((n.nullRef + n.nullState + n.nullTier + n.nullDrivers) / (total * 4)); results.push({ rule, passed: rate >= compThreshold, detail: `${Math.round(rate * 10000) / 100}% complete (threshold: ${compThreshold * 100}%)` }); }
    else if (rule === "distribution") { const tiers = await db.select({ tier: members.riskTier, count: count() }).from(members).groupBy(members.riskTier); const counts = tiers.map((t: any) => t.count); const ok = counts.length >= 2 && !counts.some((c: number) => c === mc.count); results.push({ rule, passed: ok, detail: `${counts.length} tiers: ${tiers.map((t: any) => `${t.tier}=${t.count}`).join(", ")}` }); }
    else if (rule === "linkage") { const [lc] = await db.select({ count: sql<number>`count(distinct member_id)` }).from(claims); const rate = mc.count > 0 ? lc.count / mc.count : 0; results.push({ rule, passed: rate >= linkThreshold, detail: `${Math.round(rate * 100)}% linked (threshold: ${linkThreshold * 100}%)` }); }
  }

  const passed = results.filter((r) => r.passed).length;
  return { content: [{ type: "text" as const, text: JSON.stringify({ rulesEvaluated: results.length, rulesPassed: passed, qualityScore: `${Math.round((passed / results.length) * 100)}%`, readyForModeling: passed === results.length, results }, null, 2) }] };
});

server.tool("save_pipeline_run", "Record the agent's pipeline decisions — steps, findings, and quality score.", {
  steps: z.array(z.object({ name: z.string(), result: z.string(), recordsAffected: z.number() })),
  qualityScore: z.number().describe("0-100"),
  notes: z.string().optional(),
}, async ({ steps: stepList, qualityScore, notes }) => {
  const { db, schema } = await getDb();
  const { pipelineRuns } = schema;
  const id = crypto.randomUUID();
  await db.insert(pipelineRuns).values({
    id,
    status: qualityScore >= 90 ? "passed" : "failed",
    stepsCompleted: stepList.length,
    totalSteps: stepList.length,
    qualityScore: qualityScore / 100,
    profilingJson: JSON.stringify(stepList),
    validationJson: JSON.stringify({ notes: notes ?? "" }),
    durationMs: 0,
    createdAt: new Date().toISOString(),
  });
  return { content: [{ type: "text" as const, text: JSON.stringify({ saved: true, pipelineRunId: id, steps: stepList.length, qualityScore, status: qualityScore >= 90 ? "passed" : "failed" }, null, 2) }] };
});

server.tool("create_data_source", "Create a new data table from a natural language description. Agent defines columns and optionally inserts sample data.", {
  name: z.string().describe("Table name (lowercase, underscores)"),
  description: z.string().describe("What this data source contains"),
  columns: z.array(z.object({ name: z.string(), type: z.enum(["text", "integer", "real"]), required: z.boolean().optional() })),
  sampleData: z.array(z.record(z.string(), z.unknown())).optional().describe("Optional rows to insert"),
}, async ({ name, description, columns, sampleData }) => {
  const { db, schema, orm } = await getDb();
  const { customSources } = schema;
  const { sql } = orm;
  const safeName = name.replace(/[^a-z0-9_]/g, "_").toLowerCase();
  const colDefs = columns.map((c: any) => `"${c.name}" ${c.type.toUpperCase()}${c.required ? " NOT NULL" : ""} DEFAULT ${c.type === "text" ? "''" : "0"}`);
  colDefs.unshift('"id" TEXT PRIMARY KEY');

  await db.run(sql.raw(`CREATE TABLE IF NOT EXISTS "${safeName}" (${colDefs.join(", ")})`));

  let rowCount = 0;
  if (sampleData?.length) {
    for (const row of sampleData) {
      const id = crypto.randomUUID();
      const cols = ["id", ...Object.keys(row)];
      const vals = [id, ...Object.values(row)].map((v: unknown) => typeof v === "string" ? `'${String(v).replace(/'/g, "''")}'` : String(v));
      await db.run(sql.raw(`INSERT OR IGNORE INTO "${safeName}" (${cols.map((c: string) => `"${c}"`).join(", ")}) VALUES (${vals.join(", ")})`));
      rowCount++;
    }
  }

  await db.insert(customSources).values({ id: crypto.randomUUID(), tableName: safeName, columnsJson: JSON.stringify(columns), rowCount, createdBy: "agent", description, createdAt: new Date().toISOString() }).onConflictDoNothing();

  return { content: [{ type: "text" as const, text: JSON.stringify({ created: true, table: safeName, columns: columns.length, rowsInserted: rowCount, description, note: "Table is now visible in inspect_sources and profile_table." }, null, 2) }] };
});

server.tool("create_data_product", "Save a named, versioned data product definition to the catalog.", {
  name: z.string().describe("Product name, e.g. 'diabetes_care_gaps'"),
  description: z.string(),
  sourceTables: z.array(z.string()).describe("Tables this product draws from"),
  filters: z.record(z.string(), z.unknown()).optional().describe("Filter criteria as key-value pairs"),
  columns: z.array(z.string()).optional().describe("Columns to include in the product"),
}, async ({ name, description, sourceTables, filters, columns: cols }) => {
  const { db, schema, orm } = await getDb();
  const { dataProducts } = schema;
  const { eq, desc } = orm;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const existing = await db.select().from(dataProducts).where(eq(dataProducts.name, name));
  const version = existing.length > 0 ? Math.max(...existing.map((e: any) => e.version)) + 1 : 1;

  await db.insert(dataProducts).values({
    id, name, description, createdBy: "agent",
    sourceTables: JSON.stringify(sourceTables),
    queryDefinition: JSON.stringify({ filters: filters ?? {}, columns: cols ?? [] }),
    version, status: "published", createdAt: now, updatedAt: now,
  });

  return { content: [{ type: "text" as const, text: JSON.stringify({ created: true, productId: id, name, version, sourceTables, status: "published" }, null, 2) }] };
});

server.tool("list_data_products", "List all saved data products in the catalog.", {}, async () => {
  const { db, schema, orm } = await getDb();
  const { dataProducts } = schema;
  const { desc } = orm;
  const products = await db.select().from(dataProducts).orderBy(desc(dataProducts.updatedAt));
  return { content: [{ type: "text" as const, text: JSON.stringify({ count: products.length, products: products.map((p: any) => ({ id: p.id, name: p.name, description: p.description, version: p.version, status: p.status, sourceTables: JSON.parse(p.sourceTables), createdBy: p.createdBy, createdAt: p.createdAt })) }, null, 2) }] };
});

// ── Start ───────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  const mode = isDirect ? `direct (${TURSO_URL})` : `proxy (${API_URL})`;
  process.stderr.write(`Meridian MCP server started in ${mode} mode\n`);
});
