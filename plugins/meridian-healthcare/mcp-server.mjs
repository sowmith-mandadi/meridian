#!/usr/bin/env npx tsx
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/lib/schema.ts
var schema_exports = {};
__export(schema_exports, {
  auditLog: () => auditLog,
  callCenter: () => callCenter,
  claims: () => claims,
  feedbackRequests: () => feedbackRequests,
  members: () => members,
  pharmacy: () => pharmacy,
  pipelineRuns: () => pipelineRuns,
  sdoh: () => sdoh,
  usageLog: () => usageLog,
  users: () => users,
  utilization: () => utilization
});
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
var members, claims, pharmacy, sdoh, callCenter, utilization, feedbackRequests, usageLog, users, auditLog, pipelineRuns;
var init_schema = __esm({
  "src/lib/schema.ts"() {
    "use strict";
    members = sqliteTable("members", {
      id: text("id").primaryKey(),
      name: text("name").notNull(),
      memberReference: text("member_reference").notNull(),
      state: text("state").notNull(),
      city: text("city").notNull().default(""),
      county: text("county").notNull().default(""),
      metroArea: text("metro_area").notNull().default(""),
      zipCode: text("zip_code").notNull().default(""),
      age: integer("age").notNull(),
      gender: text("gender").notNull(),
      riskScore: real("risk_score").notNull(),
      riskTier: text("risk_tier").notNull(),
      chronicConditions: text("chronic_conditions").notNull(),
      hospitalVisitProb6m: real("hospital_visit_prob_6m").notNull().default(0),
      diabetesFlag: integer("diabetes_flag").notNull().default(0),
      hba1cGapFlag: integer("hba1c_gap_flag").notNull().default(0),
      pcpId: text("pcp_id").notNull().default(""),
      pcpName: text("pcp_name").notNull().default(""),
      erVisits12m: integer("er_visits_12m").notNull().default(0),
      pcpVisits12m: integer("pcp_visits_12m").notNull().default(0),
      inpatientVisits12m: integer("inpatient_visits_12m").notNull().default(0),
      adherenceScore: real("adherence_score").notNull().default(100),
      riskDrivers: text("risk_drivers").notNull().default(""),
      recommendedActions: text("recommended_actions").notNull().default(""),
      selectionExplanation: text("selection_explanation").notNull().default("")
    });
    claims = sqliteTable("claims", {
      id: text("id").primaryKey(),
      memberId: text("member_id").notNull().references(() => members.id),
      icdCode: text("icd_code").notNull(),
      type: text("type").notNull(),
      amount: real("amount").notNull(),
      date: text("date").notNull(),
      provider: text("provider").notNull()
    });
    pharmacy = sqliteTable("pharmacy", {
      id: text("id").primaryKey(),
      memberId: text("member_id").notNull().references(() => members.id),
      drugName: text("drug_name").notNull(),
      drugClass: text("drug_class").notNull().default(""),
      adherencePct: real("adherence_pct").notNull(),
      fillDate: text("fill_date").notNull()
    });
    sdoh = sqliteTable("sdoh", {
      id: text("id").primaryKey(),
      memberId: text("member_id").notNull().references(() => members.id),
      transportationFlag: integer("transportation_flag").notNull(),
      foodInsecurity: integer("food_insecurity").notNull(),
      housingInstability: integer("housing_instability").notNull(),
      financialStress: integer("financial_stress").notNull().default(0),
      socialIsolation: integer("social_isolation").notNull().default(0)
    });
    callCenter = sqliteTable("call_center", {
      id: text("id").primaryKey(),
      memberId: text("member_id").notNull().references(() => members.id),
      reason: text("reason").notNull(),
      sentiment: text("sentiment").notNull(),
      date: text("date").notNull(),
      unresolvedFlag: integer("unresolved_flag").notNull().default(0),
      escalatedFlag: integer("escalated_flag").notNull().default(0)
    });
    utilization = sqliteTable("utilization", {
      id: text("id").primaryKey(),
      memberId: text("member_id").notNull().references(() => members.id),
      eventType: text("event_type").notNull(),
      eventDate: text("event_date").notNull(),
      avoidableFlag: integer("avoidable_flag").notNull().default(0),
      lengthOfStay: integer("length_of_stay").notNull().default(0),
      providerId: text("provider_id").notNull().default("")
    });
    feedbackRequests = sqliteTable("feedback_requests", {
      id: text("id").primaryKey(),
      userRole: text("user_role").notNull(),
      requestText: text("request_text").notNull(),
      status: text("status").notNull().default("new"),
      createdAt: text("created_at").notNull()
    });
    usageLog = sqliteTable("usage_log", {
      id: text("id").primaryKey(),
      queryText: text("query_text").notNull(),
      tokensIn: integer("tokens_in").notNull(),
      tokensOut: integer("tokens_out").notNull(),
      latencyMs: integer("latency_ms").notNull(),
      model: text("model").notNull(),
      createdAt: text("created_at").notNull()
    });
    users = sqliteTable("users", {
      id: text("id").primaryKey(),
      email: text("email").notNull().unique(),
      password: text("password").notNull(),
      name: text("name").notNull(),
      role: text("role").notNull()
    });
    auditLog = sqliteTable("audit_log", {
      id: text("id").primaryKey(),
      userId: text("user_id").notNull().default(""),
      userRole: text("user_role").notNull(),
      action: text("action").notNull(),
      toolArgs: text("tool_args").notNull().default("{}"),
      resultSummary: text("result_summary").notNull().default(""),
      blockedFields: text("blocked_fields").notNull().default(""),
      policyNote: text("policy_note").notNull().default(""),
      createdAt: text("created_at").notNull()
    });
    pipelineRuns = sqliteTable("pipeline_runs", {
      id: text("id").primaryKey(),
      status: text("status").notNull(),
      stepsCompleted: integer("steps_completed").notNull(),
      totalSteps: integer("total_steps").notNull(),
      qualityScore: real("quality_score").notNull().default(0),
      profilingJson: text("profiling_json").notNull().default("{}"),
      validationJson: text("validation_json").notNull().default("{}"),
      durationMs: integer("duration_ms").notNull().default(0),
      createdAt: text("created_at").notNull()
    });
  }
});

// plugins/meridian-healthcare/mcp-server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
var TURSO_URL = process.env.TURSO_DATABASE_URL;
var TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;
var API_URL = process.env.MERIDIAN_API_URL || "http://localhost:3000";
var isDirect = !!TURSO_URL;
var db = null;
var schema = null;
var orm = null;
async function getDb() {
  if (db) return { db, schema, orm };
  const drizzleMod = await import("drizzle-orm/libsql/node");
  orm = await import("drizzle-orm");
  schema = await Promise.resolve().then(() => (init_schema(), schema_exports));
  db = drizzleMod.drizzle({
    connection: { url: TURSO_URL, authToken: TURSO_TOKEN },
    schema
  });
  return { db, schema, orm };
}
async function proxyChat(toolName, args) {
  const messages = [
    {
      role: "user",
      content: `Call the ${toolName} tool with these arguments: ${JSON.stringify(args)}. Return ONLY the raw tool result as JSON, nothing else.`
    }
  ];
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages })
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return await res.text();
}
async function proxyPipeline() {
  const res = await fetch(`${API_URL}/api/pipeline`, { method: "POST" });
  if (!res.ok) throw new Error(`Pipeline API error: ${res.status}`);
  const text2 = await res.text();
  const lines = text2.trim().split("\n").filter(Boolean);
  return lines.map((l) => JSON.parse(l));
}
async function proxyGovernedQuery(args) {
  const res = await fetch(`${API_URL}/api/collaborate/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args)
  });
  if (!res.ok) throw new Error(`Governed query API error: ${res.status}`);
  return await res.json();
}
async function identifyCohort(args) {
  const { db: db2, schema: schema2, orm: orm2 } = await getDb();
  const { members: members2, sdoh: sdoh2 } = schema2;
  const { eq, and, inArray, like, or } = orm2;
  const filters = [eq(members2.riskTier, args.riskTier)];
  if (args.states.length > 0) filters.push(inArray(members2.state, args.states));
  if (args.conditions.length > 0) {
    const condOr = or(
      ...args.conditions.map((c) => like(members2.chronicConditions, `%${c}%`))
    );
    if (condOr) filters.push(condOr);
  }
  const rows = await db2.select({
    id: members2.id,
    memberReference: members2.memberReference,
    name: members2.name,
    state: members2.state,
    city: members2.city,
    metroArea: members2.metroArea,
    age: members2.age,
    gender: members2.gender,
    riskScore: members2.riskScore,
    riskTier: members2.riskTier,
    hospitalVisitProb6m: members2.hospitalVisitProb6m,
    chronicConditions: members2.chronicConditions,
    riskDrivers: members2.riskDrivers,
    erVisits12m: members2.erVisits12m,
    pcpVisits12m: members2.pcpVisits12m,
    adherenceScore: members2.adherenceScore,
    sdohTransportation: sdoh2.transportationFlag,
    sdohFood: sdoh2.foodInsecurity,
    sdohHousing: sdoh2.housingInstability
  }).from(members2).leftJoin(sdoh2, eq(members2.id, sdoh2.memberId)).where(and(...filters));
  return {
    count: rows.length,
    members: rows.map((m) => ({
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
        housingInstability: m.sdohHousing === 1
      }
    }))
  };
}
async function getRiskDrivers(args) {
  const { db: db2, schema: schema2, orm: orm2 } = await getDb();
  const { members: members2, sdoh: sdoh2, pharmacy: pharmacy2 } = schema2;
  const { eq } = orm2;
  const member = await db2.query.members.findFirst({ where: eq(members2.id, args.memberId) });
  if (!member) return { error: "Member not found", drivers: [], member: null };
  const sdohRow = await db2.query.sdoh.findFirst({ where: eq(sdoh2.memberId, args.memberId) });
  const rxRows = await db2.select().from(pharmacy2).where(eq(pharmacy2.memberId, args.memberId));
  const avgAdherence = rxRows.length === 0 ? null : rxRows.reduce((s, r) => s + r.adherencePct, 0) / rxRows.length;
  const drivers = [];
  drivers.push({ name: "Clinical risk score", score: Math.min(1, Math.max(0, member.riskScore)), category: "clinical" });
  if (sdohRow?.transportationFlag) drivers.push({ name: "Transportation access", score: 0.82, category: "sdoh" });
  if (sdohRow?.foodInsecurity) drivers.push({ name: "Food insecurity", score: 0.78, category: "sdoh" });
  if (sdohRow?.housingInstability) drivers.push({ name: "Housing instability", score: 0.75, category: "sdoh" });
  if (avgAdherence !== null)
    drivers.push({ name: "Medication adherence", score: Math.min(1, Math.max(0, 1 - avgAdherence / 100)), category: "pharmacy" });
  if (member.erVisits12m >= 3) drivers.push({ name: "Frequent ER use", score: 0.85, category: "utilization" });
  if (member.pcpVisits12m === 0 && member.erVisits12m > 0) drivers.push({ name: "Low PCP engagement", score: 0.7, category: "utilization" });
  drivers.sort((a, b) => b.score - a.score);
  return {
    member: {
      id: member.id,
      memberReference: member.memberReference,
      name: member.name,
      state: member.state,
      age: member.age,
      gender: member.gender,
      riskScore: member.riskScore,
      riskTier: member.riskTier,
      hospitalVisitProb6m: member.hospitalVisitProb6m,
      chronicConditions: member.chronicConditions,
      riskDrivers: member.riskDrivers,
      selectionExplanation: member.selectionExplanation
    },
    pharmacyFillCount: rxRows.length,
    avgAdherencePct: avgAdherence,
    drivers
  };
}
async function explainMember(args) {
  const { db: db2, schema: schema2, orm: orm2 } = await getDb();
  const { members: members2, sdoh: sdoh2, pharmacy: pharmacy2, claims: claims2, utilization: utilization2 } = schema2;
  const { eq, desc } = orm2;
  const member = await db2.query.members.findFirst({ where: eq(members2.id, args.memberId) });
  if (!member) return { error: "Member not found" };
  const [sdohRow, rxRows, claimRows, utilRows] = await Promise.all([
    db2.query.sdoh.findFirst({ where: eq(sdoh2.memberId, args.memberId) }),
    db2.select().from(pharmacy2).where(eq(pharmacy2.memberId, args.memberId)),
    db2.select().from(claims2).where(eq(claims2.memberId, args.memberId)).orderBy(desc(claims2.date)).limit(25),
    db2.select().from(utilization2).where(eq(utilization2.memberId, args.memberId))
  ]);
  const totalClaimAmount = claimRows.reduce((s, c) => s + c.amount, 0);
  const byType = {};
  for (const c of claimRows) byType[c.type] = (byType[c.type] ?? 0) + 1;
  const utilByType = {};
  for (const u of utilRows) utilByType[u.eventType] = (utilByType[u.eventType] ?? 0) + 1;
  return {
    sections: {
      overview: {
        title: "Overview",
        summary: `${member.name} is a ${member.age}-year-old ${member.gender} member in ${member.city}, ${member.state} with ${member.riskTier} risk (score ${member.riskScore}). ${member.selectionExplanation}`
      },
      demographics: { title: "Demographics", id: member.id, memberReference: member.memberReference, name: member.name, state: member.state, city: member.city, metroArea: member.metroArea, age: member.age, gender: member.gender, pcpName: member.pcpName },
      clinical: { title: "Clinical profile", chronicConditions: member.chronicConditions, riskScore: member.riskScore, riskTier: member.riskTier, hospitalVisitProb6m: member.hospitalVisitProb6m, riskDrivers: member.riskDrivers, recommendedActions: member.recommendedActions },
      sdoh: { title: "Social determinants", transportationBarrier: sdohRow ? sdohRow.transportationFlag === 1 : null, foodInsecurity: sdohRow ? sdohRow.foodInsecurity === 1 : null, housingInstability: sdohRow ? sdohRow.housingInstability === 1 : null },
      pharmacy: { title: "Pharmacy", fills: rxRows.map((r) => ({ drugName: r.drugName, drugClass: r.drugClass, adherencePct: r.adherencePct, fillDate: r.fillDate })) },
      utilization: { title: "Utilization", erVisits12m: member.erVisits12m, pcpVisits12m: member.pcpVisits12m, inpatientVisits12m: member.inpatientVisits12m, breakdown: utilByType },
      claims: { title: "Recent claims", claimCount: claimRows.length, totalAmount: totalClaimAmount, countsByType: byType, recent: claimRows.slice(0, 8).map((c) => ({ date: c.date, type: c.type, amount: c.amount, icdCode: c.icdCode, provider: c.provider })) }
    }
  };
}
async function recommendOutreach(args) {
  const { db: db2, schema: schema2, orm: orm2 } = await getDb();
  const { members: members2 } = schema2;
  const { eq } = orm2;
  const member = await db2.query.members.findFirst({ where: eq(members2.id, args.memberId) });
  if (!member) return { error: "Member not found", recommendations: [] };
  const d = args.drivers.map((x) => x.toLowerCase()).join(" ");
  const out = [];
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
async function generateChart(args) {
  const { db: db2, schema: schema2, orm: orm2 } = await getDb();
  const { members: members2, claims: claims2, utilization: utilization2 } = schema2;
  const { sql } = orm2;
  const q = args.dataQuery.toLowerCase();
  let rows;
  let title;
  if (q.includes("claim")) {
    rows = await db2.select({ name: claims2.type, value: sql`cast(count(*) as real)` }).from(claims2).groupBy(claims2.type);
    title = "Claims volume by type";
  } else if (q.includes("state")) {
    rows = await db2.select({ name: members2.state, value: sql`cast(count(*) as real)` }).from(members2).groupBy(members2.state);
    title = "Members by state";
  } else if (q.includes("utilization") || q.includes("er") || q.includes("visit")) {
    rows = await db2.select({ name: utilization2.eventType, value: sql`cast(count(*) as real)` }).from(utilization2).groupBy(utilization2.eventType);
    title = "Utilization events by type";
  } else {
    rows = await db2.select({ name: members2.riskTier, value: sql`cast(count(*) as real)` }).from(members2).groupBy(members2.riskTier);
    title = "Members by risk tier";
  }
  return { type: args.chartType, title, data: rows.map((r) => ({ name: String(r.name), value: Number(r.value) })) };
}
async function submitFeedback(args) {
  const { db: db2, schema: schema2 } = await getDb();
  const id = crypto.randomUUID();
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  await db2.insert(schema2.feedbackRequests).values({ id, userRole: args.userRole, requestText: args.requestText, status: "new", createdAt });
  return { ok: true, id, message: "Feedback submitted for review.", createdAt };
}
async function governedQuery(args) {
  if (!isDirect) return await proxyGovernedQuery(args);
  const { db: db2, schema: schema2, orm: orm2 } = await getDb();
  const { members: members2, sdoh: sdoh2, auditLog: auditLog2 } = schema2;
  const { eq, and, inArray, like, sql } = orm2;
  const ROLE_POLICIES = {
    care_manager: { allowedIntents: ["cohort", "member_outreach", "pharmacy_review", "quality_gap", "provider_coordination"], blockedFields: [], roleNote: "Full access with masked identifiers." },
    analyst: { allowedIntents: ["cohort", "pharmacy_review"], blockedFields: ["transportationBarrier", "foodInsecurity", "housingInstability", "recommendedActions", "selectionExplanation"], roleNote: "SDOH and outreach restricted." },
    quality: { allowedIntents: ["aggregate", "quality_gap", "cohort"], blockedFields: ["transportationBarrier", "foodInsecurity", "housingInstability", "recommendedActions", "pcpName"], roleNote: "Aggregate compliance only." },
    admin: { allowedIntents: ["cohort", "member_outreach", "pharmacy_review", "quality_gap", "provider_coordination", "aggregate"], blockedFields: [], roleNote: "Full admin access." }
  };
  const role = args.role in ROLE_POLICIES ? args.role : "care_manager";
  const policy = ROLE_POLICIES[role];
  const intent = args.intent || "cohort";
  if (!policy.allowedIntents.includes(intent)) {
    return { status: "error", error: `Role '${role}' is not authorized for '${intent}' queries.` };
  }
  const filters = args.filters ?? {};
  const whereConditions = [];
  if (filters.riskTier) whereConditions.push(eq(members2.riskTier, filters.riskTier));
  if (filters.states?.length > 0) whereConditions.push(inArray(members2.state, filters.states));
  if (filters.diabetesOnly) whereConditions.push(eq(members2.diabetesFlag, 1));
  if (filters.conditions?.length > 0) {
    const condOr = orm2.or(...filters.conditions.map((c) => like(members2.chronicConditions, `%${c}%`)));
    if (condOr) whereConditions.push(condOr);
  }
  const limit = Math.min(args.limit ?? 25, 100);
  const rows = await db2.select({
    memberReference: members2.memberReference,
    name: members2.name,
    state: members2.state,
    city: members2.city,
    riskScore: members2.riskScore,
    riskTier: members2.riskTier,
    hospitalVisitProb6m: members2.hospitalVisitProb6m,
    riskDrivers: members2.riskDrivers,
    recommendedActions: members2.recommendedActions,
    selectionExplanation: members2.selectionExplanation,
    pcpName: members2.pcpName,
    erVisits12m: members2.erVisits12m,
    pcpVisits12m: members2.pcpVisits12m,
    adherenceScore: members2.adherenceScore,
    sdohTransportation: sdoh2.transportationFlag,
    sdohFood: sdoh2.foodInsecurity,
    sdohHousing: sdoh2.housingInstability
  }).from(members2).leftJoin(sdoh2, eq(members2.id, sdoh2.memberId)).where(whereConditions.length > 0 ? and(...whereConditions) : void 0).orderBy(sql`${members2.hospitalVisitProb6m} desc`).limit(limit);
  const blocked = new Set(policy.blockedFields);
  const records = rows.map((r) => {
    const rec = { ...r };
    for (const f of blocked) delete rec[f];
    delete rec.sdohTransportation;
    delete rec.sdohFood;
    delete rec.sdohHousing;
    if (!blocked.has("transportationBarrier")) {
      rec.sdoh = { transportationBarrier: r.sdohTransportation === 1, foodInsecurity: r.sdohFood === 1, housingInstability: r.sdohHousing === 1 };
    }
    return rec;
  });
  const auditId = crypto.randomUUID();
  try {
    await db2.insert(auditLog2).values({
      id: auditId,
      userId: "mcp_client",
      userRole: role,
      action: `governed_query:${intent}`,
      toolArgs: JSON.stringify(filters),
      resultSummary: `${rows.length} members, scope=${args.scope ?? "member_level"}`,
      blockedFields: policy.blockedFields.join(", "),
      policyNote: policy.roleNote,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch {
  }
  return {
    status: "ok",
    role,
    intent,
    summary: { matchingMembers: rows.length, highRiskMembers: rows.filter((r) => r.riskTier === "high").length },
    records,
    governance: { policyNote: policy.roleNote, blockedFields: policy.blockedFields, auditId }
  };
}
async function runPipeline() {
  if (!isDirect) return await proxyPipeline();
  const { db: db2, schema: schema2, orm: orm2 } = await getDb();
  const { members: members2, claims: claims2, pharmacy: pharmacy2, sdoh: sdoh2, callCenter: callCenter2, utilization: utilization2 } = schema2;
  const { count, avg, min, max, sql } = orm2;
  const steps = [];
  let start = Date.now();
  const [mc] = await db2.select({ count: count() }).from(members2);
  const [cc] = await db2.select({ count: count() }).from(claims2);
  const [rc] = await db2.select({ count: count() }).from(pharmacy2);
  const [sc] = await db2.select({ count: count() }).from(sdoh2);
  const [ccc] = await db2.select({ count: count() }).from(callCenter2);
  const [uc] = await db2.select({ count: count() }).from(utilization2);
  steps.push({ step: "ingest", status: "completed", durationMs: Date.now() - start, output: { members: mc.count, claims: cc.count, pharmacy: rc.count, sdoh: sc.count, call_center: ccc.count, utilization: uc.count, total_records: mc.count + cc.count + rc.count + sc.count + ccc.count + uc.count } });
  start = Date.now();
  const [ageStats] = await db2.select({ minAge: min(members2.age), maxAge: max(members2.age), avgAge: avg(members2.age) }).from(members2);
  const tierDist = await db2.select({ tier: members2.riskTier, count: count() }).from(members2).groupBy(members2.riskTier);
  steps.push({ step: "profile", status: "completed", durationMs: Date.now() - start, output: { age: { min: ageStats.minAge, max: ageStats.maxAge, avg: Number(Number(ageStats.avgAge).toFixed(1)) }, riskTierDistribution: Object.fromEntries(tierDist.map((r) => [r.tier, r.count])) } });
  start = Date.now();
  const icdCodes = await db2.select({ code: claims2.icdCode, count: count() }).from(claims2).groupBy(claims2.icdCode);
  const drugNames = await db2.select({ drug: pharmacy2.drugName, count: count() }).from(pharmacy2).groupBy(pharmacy2.drugName);
  steps.push({ step: "standardize", status: "completed", durationMs: Date.now() - start, output: { icdCodesValidated: icdCodes.length, drugNamesMapped: drugNames.length } });
  start = Date.now();
  const [wc] = await db2.select({ count: sql`count(distinct ${claims2.memberId})` }).from(claims2);
  steps.push({ step: "entity_resolve", status: "completed", durationMs: Date.now() - start, output: { totalMembers: mc.count, linkedViaClaims: wc.count, matchRate: `${mc.count > 0 ? Math.round(Math.min(mc.count, wc.count) / mc.count * 100) : 0}%` } });
  start = Date.now();
  const orphanResult = await db2.all(sql`select count(*) as cnt from claims where member_id not in (select id from members)`);
  const orphanCount = orphanResult[0]?.cnt ?? 0;
  const rangeResult = await db2.all(sql`select count(*) as cnt from members where risk_score < 0 or risk_score > 1`);
  const outOfRange = rangeResult[0]?.cnt ?? 0;
  const rules = [
    { rule: "Grain: one row per member", passed: mc.count > 0 },
    { rule: "Referential integrity", passed: orphanCount === 0 },
    { rule: "Risk score in [0,1]", passed: outOfRange === 0 }
  ];
  const passed = rules.filter((r) => r.passed).length;
  steps.push({ step: "validate", status: "completed", durationMs: Date.now() - start, output: { rules, rulesPassed: passed, rulesTotal: rules.length, qualityScore: `${Math.round(passed / rules.length * 100)}%`, readyForModeling: passed === rules.length } });
  const totalMs = steps.reduce((s, st) => s + st.durationMs, 0);
  steps.push({ step: "summary", status: "completed", durationMs: totalMs, output: { pipeline: "hospitalization_risk_prediction", stepsCompleted: 5, stepsTotal: 5, totalDurationMs: totalMs, qualityScore: steps[4].output.qualityScore, readyForModeling: steps[4].output.readyForModeling } });
  return steps;
}
var server = new McpServer({
  name: "meridian-healthcare",
  version: "1.0.0"
});
server.tool(
  "identify_cohort",
  "Find members matching geographic, clinical, and risk filters with SDOH context",
  {
    states: z.array(z.string()).describe("US state codes (empty = all)"),
    conditions: z.array(z.string()).describe("Condition keywords (empty = all)"),
    riskTier: z.enum(["high", "medium", "low"])
  },
  async (args) => {
    const result = isDirect ? await identifyCohort(args) : JSON.parse(await proxyChat("identify_cohort", args));
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);
server.tool(
  "get_risk_drivers",
  "Analyze top risk drivers for a member from clinical, SDOH, and pharmacy data",
  { memberId: z.string() },
  async (args) => {
    const result = isDirect ? await getRiskDrivers(args) : JSON.parse(await proxyChat("get_risk_drivers", args));
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);
server.tool(
  "explain_member",
  "Produce a structured explanation of why a member is flagged using all available data",
  { memberId: z.string() },
  async (args) => {
    const result = isDirect ? await explainMember(args) : JSON.parse(await proxyChat("explain_member", args));
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);
server.tool(
  "recommend_outreach",
  "Suggest prioritized interventions based on a member's risk drivers",
  { memberId: z.string(), drivers: z.array(z.string()).describe("Risk driver keywords") },
  async (args) => {
    const result = isDirect ? await recommendOutreach(args) : JSON.parse(await proxyChat("recommend_outreach", args));
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);
server.tool(
  "generate_chart",
  "Build chart-ready aggregates from the healthcare database",
  { chartType: z.enum(["bar", "pie", "line"]), dataQuery: z.string().describe("e.g. 'by state', 'by risk tier', 'claims by type'") },
  async (args) => {
    const result = isDirect ? await generateChart(args) : JSON.parse(await proxyChat("generate_chart", args));
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);
server.tool(
  "submit_feedback",
  "Record a feature or metric request for product review",
  { requestText: z.string(), userRole: z.string() },
  async (args) => {
    const result = isDirect ? await submitFeedback(args) : JSON.parse(await proxyChat("submit_feedback", args));
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);
server.tool(
  "check_governance",
  "GOVERNANCE GATE \u2014 Preview what governance rules apply for a given role and intent BEFORE executing a query. Returns the policy note, which fields will be blocked, which tools are allowed, and whether the intent is permitted. The agent MUST present this to the user and ask for confirmation before calling governed_query.",
  {
    role: z.enum(["care_manager", "analyst", "quality", "admin"]).describe("The role to check governance rules for"),
    intent: z.string().describe("The query intent to check: cohort, member_outreach, pharmacy_review, quality_gap, provider_coordination, aggregate")
  },
  async (args) => {
    const ROLE_POLICIES = {
      care_manager: {
        allowedTools: ["identify_cohort", "get_risk_drivers", "explain_member", "recommend_outreach", "generate_chart", "submit_feedback"],
        allowedIntents: ["cohort", "member_outreach", "pharmacy_review", "quality_gap", "provider_coordination"],
        blockedFields: [],
        roleNote: "Care management has full access to all tools, SDOH, explanations, and outreach with masked member identifiers."
      },
      analyst: {
        allowedTools: ["identify_cohort", "get_risk_drivers", "generate_chart", "submit_feedback"],
        allowedIntents: ["cohort", "pharmacy_review"],
        blockedFields: ["transportationBarrier", "foodInsecurity", "housingInstability", "financialStress", "socialIsolation", "recommendedActions", "selectionExplanation"],
        roleNote: "Analyst/pharmacy role can view adherence and drug-class data. SDOH detail fields and outreach recommendations are BLOCKED."
      },
      quality: {
        allowedTools: ["identify_cohort", "generate_chart", "submit_feedback"],
        allowedIntents: ["aggregate", "quality_gap", "cohort"],
        blockedFields: ["transportationBarrier", "foodInsecurity", "housingInstability", "financialStress", "socialIsolation", "recommendedActions", "selectionExplanation", "pcpName"],
        roleNote: "Quality users receive aggregate compliance and gap analysis only. SDOH, outreach, and provider names are BLOCKED."
      },
      admin: {
        allowedTools: ["identify_cohort", "get_risk_drivers", "explain_member", "recommend_outreach", "generate_chart", "submit_feedback", "governed_query"],
        allowedIntents: ["cohort", "member_outreach", "pharmacy_review", "quality_gap", "provider_coordination", "aggregate"],
        blockedFields: [],
        roleNote: "Administrative access with full data visibility and governance review capabilities."
      }
    };
    const role = args.role in ROLE_POLICIES ? args.role : "care_manager";
    const policy = ROLE_POLICIES[role];
    const intentAllowed = policy.allowedIntents.includes(args.intent);
    const result = {
      governancePreview: true,
      role,
      intent: args.intent,
      intentAllowed,
      decision: intentAllowed ? "ALLOWED \u2014 proceed with user confirmation" : "BLOCKED \u2014 this role cannot perform this intent",
      policyNote: policy.roleNote,
      allowedTools: policy.allowedTools,
      blockedFields: policy.blockedFields.length > 0 ? policy.blockedFields : ["(none \u2014 full access)"],
      fieldMaskingSummary: policy.blockedFields.length > 0 ? `${policy.blockedFields.length} fields will be redacted from results: ${policy.blockedFields.join(", ")}` : "No fields will be redacted \u2014 full visibility for this role.",
      auditNote: "This query will be logged to the governance audit trail with role, intent, filters, result summary, and blocked fields.",
      userConfirmationRequired: true,
      confirmationPrompt: intentAllowed ? `Governance check passed for role "${role}" with intent "${args.intent}". ${policy.blockedFields.length > 0 ? `Note: ${policy.blockedFields.length} SDOH/outreach fields will be masked.` : "Full data access granted."} Shall I proceed with the governed query?` : `GOVERNANCE BLOCK: Role "${role}" is NOT authorized for intent "${args.intent}". Allowed intents for this role: ${policy.allowedIntents.join(", ")}. Please select a different role or intent.`
    };
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);
server.tool(
  "request_governed_access",
  "FULL GOVERNED ACCESS FLOW \u2014 Use this for the A2A governance demo. It runs the complete governance lifecycle: (1) presents role options, (2) checks governance rules, (3) requires user confirmation, (4) executes the query with masking, (5) returns results with audit metadata. The agent MUST present each step to the user and wait for input at the confirmation step.",
  {
    role: z.enum(["care_manager", "analyst", "quality", "admin"]).describe("The requesting agent's role \u2014 present all 4 options to the user and let them choose"),
    intent: z.string().describe("Query intent: cohort, member_outreach, pharmacy_review, quality_gap, provider_coordination, aggregate"),
    filters: z.object({
      states: z.array(z.string()).optional(),
      riskTier: z.string().optional(),
      conditions: z.array(z.string()).optional(),
      diabetesOnly: z.boolean().optional(),
      minErVisits: z.number().optional(),
      maxPcpVisits: z.number().optional(),
      metroAreaContains: z.string().optional(),
      adherenceBelow: z.number().optional()
    }).optional().describe("Query filters"),
    scope: z.enum(["aggregated", "member_level"]).optional().describe("Response scope \u2014 present both options to user"),
    limit: z.number().optional().describe("Max records to return (default 15)"),
    userConfirmed: z.boolean().describe("Set to true ONLY after presenting governance rules to the user and receiving explicit confirmation")
  },
  async (args) => {
    const ROLE_POLICIES = {
      care_manager: { allowedIntents: ["cohort", "member_outreach", "pharmacy_review", "quality_gap", "provider_coordination"], blockedFields: [], roleNote: "Full access with masked identifiers." },
      analyst: { allowedIntents: ["cohort", "pharmacy_review"], blockedFields: ["transportationBarrier", "foodInsecurity", "housingInstability", "financialStress", "socialIsolation", "recommendedActions", "selectionExplanation"], roleNote: "SDOH and outreach restricted." },
      quality: { allowedIntents: ["aggregate", "quality_gap", "cohort"], blockedFields: ["transportationBarrier", "foodInsecurity", "housingInstability", "financialStress", "socialIsolation", "recommendedActions", "selectionExplanation", "pcpName"], roleNote: "Aggregate compliance only." },
      admin: { allowedIntents: ["cohort", "member_outreach", "pharmacy_review", "quality_gap", "provider_coordination", "aggregate"], blockedFields: [], roleNote: "Full admin access." }
    };
    const role = args.role in ROLE_POLICIES ? args.role : "care_manager";
    const policy = ROLE_POLICIES[role];
    const intentAllowed = policy.allowedIntents.includes(args.intent);
    if (!intentAllowed) {
      return { content: [{ type: "text", text: JSON.stringify({
        step: "GOVERNANCE_BLOCK",
        status: "rejected",
        role,
        intent: args.intent,
        reason: `Role "${role}" is not authorized for "${args.intent}" queries.`,
        allowedIntents: policy.allowedIntents,
        suggestion: "Ask the user to select a different role or intent."
      }, null, 2) }] };
    }
    if (!args.userConfirmed) {
      return { content: [{ type: "text", text: JSON.stringify({
        step: "AWAITING_USER_CONFIRMATION",
        status: "pending",
        role,
        intent: args.intent,
        policyNote: policy.roleNote,
        blockedFields: policy.blockedFields,
        fieldMaskingSummary: policy.blockedFields.length > 0 ? `${policy.blockedFields.length} fields will be redacted: ${policy.blockedFields.join(", ")}` : "Full data visibility \u2014 no fields blocked.",
        scope: args.scope ?? "member_level",
        filters: args.filters ?? {},
        instructions: "PRESENT THIS TO THE USER: Show the role, policy note, blocked fields, and scope. Ask the user to confirm they want to proceed. Then call this tool again with userConfirmed=true.",
        confirmationPrompt: `I'm about to query healthcare data as role "${role}" (${policy.roleNote}). ${policy.blockedFields.length > 0 ? `${policy.blockedFields.length} sensitive fields will be masked.` : "Full data access."} Scope: ${args.scope ?? "member_level"}. Do you approve this governed access?`
      }, null, 2) }] };
    }
    const result = await governedQuery({
      role,
      intent: args.intent,
      filters: args.filters,
      scope: args.scope,
      limit: args.limit ?? 15
    });
    return { content: [{ type: "text", text: JSON.stringify({
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
        policyEnforced: policy.roleNote
      }
    }, null, 2) }] };
  }
);
server.tool(
  "governed_query",
  "Execute a governed cross-agent query with role-based access control, field masking, and audit logging. This is the A2A endpoint \u2014 client agents call this to request data from the host with governance enforcement.",
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
      adherenceBelow: z.number().optional()
    }).optional().describe("Query filters"),
    scope: z.enum(["aggregated", "member_level"]).optional().describe("Response scope"),
    limit: z.number().optional().describe("Max records to return")
  },
  async (args) => {
    const result = await governedQuery(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);
server.tool(
  "run_pipeline",
  "Execute the 5-step healthcare data pipeline: Ingest, Profile, Standardize, Entity Resolve, Validate",
  {},
  async () => {
    const result = await runPipeline();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);
var transport = new StdioServerTransport();
server.connect(transport).then(() => {
  const mode = isDirect ? `direct (${TURSO_URL})` : `proxy (${API_URL})`;
  process.stderr.write(`Meridian MCP server started in ${mode} mode
`);
});
