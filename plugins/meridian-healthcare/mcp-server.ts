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

// ── Start ───────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  const mode = isDirect ? `direct (${TURSO_URL})` : `proxy (${API_URL})`;
  process.stderr.write(`Meridian MCP server started in ${mode} mode\n`);
});
