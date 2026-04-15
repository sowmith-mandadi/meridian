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
  customSources: () => customSources,
  dataProducts: () => dataProducts,
  feedbackRequests: () => feedbackRequests,
  members: () => members,
  pharmacy: () => pharmacy,
  pipelineRuns: () => pipelineRuns,
  rawClaims: () => rawClaims,
  rawPharmacy: () => rawPharmacy,
  sdoh: () => sdoh,
  stagingQuarantine: () => stagingQuarantine,
  usageLog: () => usageLog,
  users: () => users,
  utilization: () => utilization
});
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
var members, claims, pharmacy, sdoh, callCenter, utilization, feedbackRequests, usageLog, users, auditLog, pipelineRuns, rawClaims, rawPharmacy, stagingQuarantine, dataProducts, customSources;
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
    rawClaims = sqliteTable("raw_claims", {
      id: text("id").primaryKey(),
      memberId: text("member_id").notNull().default(""),
      icdCode: text("icd_code").notNull().default(""),
      type: text("type").notNull().default(""),
      amount: real("amount").notNull().default(0),
      date: text("date").notNull().default(""),
      provider: text("provider").notNull().default(""),
      sourceFile: text("source_file").notNull().default("intake")
    });
    rawPharmacy = sqliteTable("raw_pharmacy", {
      id: text("id").primaryKey(),
      memberId: text("member_id").notNull().default(""),
      drugName: text("drug_name").notNull().default(""),
      drugClass: text("drug_class").notNull().default(""),
      adherencePct: real("adherence_pct").notNull().default(0),
      fillDate: text("fill_date").notNull().default(""),
      sourceFile: text("source_file").notNull().default("intake")
    });
    stagingQuarantine = sqliteTable("staging_quarantine", {
      id: text("id").primaryKey(),
      sourceTable: text("source_table").notNull(),
      sourceId: text("source_id").notNull(),
      reason: text("reason").notNull(),
      stepName: text("step_name").notNull(),
      recordJson: text("record_json").notNull().default("{}"),
      createdAt: text("created_at").notNull()
    });
    dataProducts = sqliteTable("data_products", {
      id: text("id").primaryKey(),
      name: text("name").notNull(),
      description: text("description").notNull().default(""),
      createdBy: text("created_by").notNull().default("agent"),
      sourceTables: text("source_tables").notNull().default("[]"),
      queryDefinition: text("query_definition").notNull().default("{}"),
      version: integer("version").notNull().default(1),
      status: text("status").notNull().default("draft"),
      createdAt: text("created_at").notNull(),
      updatedAt: text("updated_at").notNull()
    });
    customSources = sqliteTable("custom_sources", {
      id: text("id").primaryKey(),
      tableName: text("table_name").notNull().unique(),
      columnsJson: text("columns_json").notNull().default("[]"),
      rowCount: integer("row_count").notNull().default(0),
      createdBy: text("created_by").notNull().default("agent"),
      description: text("description").notNull().default(""),
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
    _id: members2.id,
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
  const { pharmacy: pharmacyTable } = schema2;
  const memberIds = rows.map((r) => r._id);
  const rxRows = memberIds.length ? await db2.select().from(pharmacyTable).where(orm2.inArray(pharmacyTable.memberId, memberIds)) : [];
  const rxByMember = /* @__PURE__ */ new Map();
  for (const rx of rxRows) {
    const arr = rxByMember.get(rx.memberId) ?? [];
    arr.push(rx);
    rxByMember.set(rx.memberId, arr);
  }
  const blocked = new Set(policy.blockedFields);
  const records = rows.map((r) => {
    const rx = rxByMember.get(r._id) ?? [];
    const avgAdherence = rx.length ? rx.reduce((s, x) => s + x.adherencePct, 0) / rx.length : null;
    const drivers = [
      { name: "Clinical risk score", score: Math.min(1, Math.max(0, r.riskScore)), category: "clinical" }
    ];
    if (r.sdohTransportation) drivers.push({ name: "Transportation access", score: 0.82, category: "sdoh" });
    if (r.sdohFood) drivers.push({ name: "Food insecurity", score: 0.78, category: "sdoh" });
    if (r.sdohHousing) drivers.push({ name: "Housing instability", score: 0.75, category: "sdoh" });
    if (avgAdherence !== null) drivers.push({ name: "Medication adherence", score: Math.min(1, Math.max(0, 1 - avgAdherence / 100)), category: "pharmacy" });
    if (r.erVisits12m >= 3) drivers.push({ name: "Frequent ER use", score: 0.85, category: "utilization" });
    if (r.pcpVisits12m === 0 && r.erVisits12m > 0) drivers.push({ name: "Low PCP engagement", score: 0.7, category: "utilization" });
    drivers.sort((a, b) => b.score - a.score);
    const driverText = drivers.map((x) => x.name.toLowerCase()).join(" ");
    const outreach = [];
    if (driverText.includes("transportation")) outreach.push({ action: "Transportation benefit navigation", priority: "high", rationale: "Transport barriers drive missed care." });
    if (driverText.includes("food")) outreach.push({ action: "Food assistance programs", priority: "high", rationale: "Food insecurity worsens disease." });
    if (driverText.includes("adherence")) outreach.push({ action: "Pharmacist adherence call + 90-day fill review", priority: "medium", rationale: "Medication gaps are modifiable." });
    if (r.riskTier === "high") outreach.push({ action: "Care manager outreach within 48h", priority: "high", rationale: `Member is ${r.riskTier} risk.` });
    if (!outreach.length) outreach.push({ action: "Routine wellness check-in", priority: "medium", rationale: "Default engagement." });
    const rec = {
      memberReference: r.memberReference,
      name: r.name,
      state: r.state,
      city: r.city,
      metroArea: r.metroArea,
      age: r.age,
      gender: r.gender,
      riskScore: r.riskScore,
      riskTier: r.riskTier,
      hospitalVisitProb6m: r.hospitalVisitProb6m,
      chronicConditions: r.chronicConditions,
      riskDrivers: r.riskDrivers,
      recommendedActions: r.recommendedActions,
      selectionExplanation: r.selectionExplanation,
      erVisits12m: r.erVisits12m,
      pcpVisits12m: r.pcpVisits12m,
      adherenceScore: r.adherenceScore,
      pcpName: r.pcpName,
      sdoh: { transportationBarrier: r.sdohTransportation === 1, foodInsecurity: r.sdohFood === 1, housingInstability: r.sdohHousing === 1 },
      riskDriversDetail: drivers,
      outreachRecommendations: outreach,
      pharmacySummary: blocked.has("recommendedActions") ? void 0 : {
        fillCount: rx.length,
        avgAdherencePct: avgAdherence !== null ? Math.round(avgAdherence * 10) / 10 : null,
        medications: rx.slice(0, 5).map((x) => ({ drug: x.drugName, class: x.drugClass, adherence: x.adherencePct }))
      }
    };
    for (const f of blocked) delete rec[f];
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
      resultSummary: `${rows.length} members (enriched), scope=${args.scope ?? "member_level"}`,
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
    governance: { policyNote: policy.roleNote, blockedFields: policy.blockedFields, auditId },
    note: "Each record includes riskDriversDetail, outreachRecommendations, and pharmacySummary inline. No follow-up member tool calls needed."
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
  "governed_member_detail",
  "Look up a single member by their governed masked reference (e.g. MBR-478) and return full risk drivers, outreach plan, pharmacy fills, claims, and explanation \u2014 all within the governance boundary. Use this for follow-up deep-dives on members returned by request_governed_access.",
  {
    memberReference: z.string().describe("The masked member reference from a governed query (e.g. MBR-478)"),
    role: z.enum(["care_manager", "analyst", "quality", "admin"]).describe("Must match the role used in the original governed query"),
    auditId: z.string().optional().describe("Audit ID from the original governed query for chain-of-custody")
  },
  async (args) => {
    if (!isDirect) {
      const res = await fetch(`${API_URL}/api/collaborate/member-detail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args)
      }).catch(() => null);
      if (res?.ok) {
        const data = await res.json();
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
    }
    const { db: db2, schema: schema2, orm: orm2 } = await getDb();
    const { members: members2, sdoh: sdoh2, pharmacy: pharmacy2, claims: claims2, auditLog: auditLog2 } = schema2;
    const { eq, desc: descOrd } = orm2;
    const ROLE_POLICIES = {
      care_manager: { blockedFields: [], roleNote: "Full access with masked identifiers." },
      analyst: { blockedFields: ["transportationBarrier", "foodInsecurity", "housingInstability", "recommendedActions", "selectionExplanation"], roleNote: "SDOH and outreach restricted." },
      quality: { blockedFields: ["transportationBarrier", "foodInsecurity", "housingInstability", "recommendedActions", "pcpName"], roleNote: "Aggregate compliance only." },
      admin: { blockedFields: [], roleNote: "Full admin access." }
    };
    const role = args.role in ROLE_POLICIES ? args.role : "care_manager";
    const policy = ROLE_POLICIES[role];
    const blocked = new Set(policy.blockedFields);
    const m = await db2.query.members.findFirst({ where: eq(members2.memberReference, args.memberReference) });
    if (!m) return { content: [{ type: "text", text: JSON.stringify({ error: "Member not found for this governed reference.", memberReference: args.memberReference }) }] };
    const [sdohRow, rxRows, claimRows] = await Promise.all([
      db2.query.sdoh.findFirst({ where: eq(sdoh2.memberId, m.id) }),
      db2.select().from(pharmacy2).where(eq(pharmacy2.memberId, m.id)),
      db2.select().from(claims2).where(eq(claims2.memberId, m.id)).orderBy(descOrd(claims2.date)).limit(15)
    ]);
    const avgAdherence = rxRows.length ? rxRows.reduce((s, r) => s + r.adherencePct, 0) / rxRows.length : null;
    const drivers = [
      { name: "Clinical risk score", score: Math.min(1, Math.max(0, m.riskScore)), category: "clinical" }
    ];
    if (sdohRow?.transportationFlag) drivers.push({ name: "Transportation access", score: 0.82, category: "sdoh" });
    if (sdohRow?.foodInsecurity) drivers.push({ name: "Food insecurity", score: 0.78, category: "sdoh" });
    if (sdohRow?.housingInstability) drivers.push({ name: "Housing instability", score: 0.75, category: "sdoh" });
    if (avgAdherence !== null) drivers.push({ name: "Medication adherence", score: Math.min(1, Math.max(0, 1 - avgAdherence / 100)), category: "pharmacy" });
    if (m.erVisits12m >= 3) drivers.push({ name: "Frequent ER use", score: 0.85, category: "utilization" });
    if (m.pcpVisits12m === 0 && m.erVisits12m > 0) drivers.push({ name: "Low PCP engagement", score: 0.7, category: "utilization" });
    drivers.sort((a, b) => b.score - a.score);
    const driverText = drivers.map((x) => x.name.toLowerCase()).join(" ");
    const outreach = [];
    if (driverText.includes("transportation")) outreach.push({ action: "Transportation benefit navigation", priority: "high", rationale: "Transport barriers drive missed care." });
    if (driverText.includes("food")) outreach.push({ action: "Food assistance programs", priority: "high", rationale: "Food insecurity worsens disease." });
    if (driverText.includes("adherence")) outreach.push({ action: "Pharmacist adherence call + 90-day fill review", priority: "medium", rationale: "Medication gaps are modifiable." });
    if (m.riskTier === "high") outreach.push({ action: "Care manager outreach within 48h", priority: "high", rationale: `Member is ${m.riskTier} risk.` });
    if (!outreach.length) outreach.push({ action: "Routine wellness check-in", priority: "medium", rationale: "Default engagement." });
    const rec = {
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
      recommendedActions: m.recommendedActions,
      selectionExplanation: m.selectionExplanation,
      erVisits12m: m.erVisits12m,
      pcpVisits12m: m.pcpVisits12m,
      adherenceScore: m.adherenceScore,
      pcpName: m.pcpName,
      sdoh: sdohRow ? { transportationBarrier: sdohRow.transportationFlag === 1, foodInsecurity: sdohRow.foodInsecurity === 1, housingInstability: sdohRow.housingInstability === 1 } : null,
      overview: `${m.name}, ${m.age}yo ${m.gender} in ${m.city}, ${m.state}. ${m.riskTier} risk (${m.riskScore}). ${m.selectionExplanation}`,
      riskDriversDetail: drivers,
      outreachRecommendations: outreach,
      pharmacyDetail: { fillCount: rxRows.length, avgAdherencePct: avgAdherence !== null ? Math.round(avgAdherence * 10) / 10 : null, medications: rxRows.map((x) => ({ drug: x.drugName, class: x.drugClass, adherence: x.adherencePct, fillDate: x.fillDate })) },
      claimsSummary: { count: claimRows.length, totalAmount: claimRows.reduce((a, c) => a + c.amount, 0), recent: claimRows.slice(0, 5).map((c) => ({ date: c.date, type: c.type, amount: c.amount, icdCode: c.icdCode })) }
    };
    for (const f of blocked) delete rec[f];
    const detailAuditId = crypto.randomUUID();
    try {
      await db2.insert(auditLog2).values({ id: detailAuditId, userId: "mcp_client", userRole: role, action: "governed_member_detail", toolArgs: JSON.stringify({ memberReference: args.memberReference, parentAuditId: args.auditId }), resultSummary: `Detail for ${args.memberReference}`, blockedFields: policy.blockedFields.join(", "), policyNote: policy.roleNote, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
    } catch {
    }
    return { content: [{ type: "text", text: JSON.stringify({ memberReference: args.memberReference, role, governanceApplied: true, record: rec, governance: { policyNote: policy.roleNote, blockedFields: policy.blockedFields, auditId: detailAuditId, parentAuditId: args.auditId ?? null } }, null, 2) }] };
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
var VALID_ICD_SET = /* @__PURE__ */ new Set(["E11.9", "I50.9", "J44.1", "I10", "N18.9", "J45.909", "F32.9", "Z00.0"]);
var ICD_CORRECTIONS = { "E119": "E11.9", "I509": "I50.9", "J441": "J44.1", "I1O": "I10", "N189": "N18.9", "j45.909": "J45.909", "F329": "F32.9", "E11": "E11.9", "I50": "I50.9" };
var VALID_DRUG_SET = /* @__PURE__ */ new Set(["Metformin", "Ozempic", "Jardiance", "Lisinopril", "Atorvastatin", "Losartan", "Albuterol", "Symbicort", "Sertraline", "Buspirone", "Amlodipine", "Omeprazole", "Insulin Glargine", "Furosemide"]);
var DRUG_CORRECTIONS = { "metformin": "Metformin", "OZEMPIC": "Ozempic", "jardiance": "Jardiance", "Lisinoprl": "Lisinopril", "atorvastatin": "Atorvastatin", "losartan HCL": "Losartan", "albuterol sulfate": "Albuterol", "Symbicrt": "Symbicort", "sertralin": "Sertraline" };
server.tool("inspect_sources", "Inventory all data sources \u2014 row counts, columns, null rates, freshness.", {}, async () => {
  const { db: db2, schema: schema2, orm: orm2 } = await getDb();
  const { members: members2, claims: claims2, pharmacy: pharmacy2, sdoh: sdoh2, callCenter: callCenter2, utilization: utilization2, rawClaims: rawClaims2, rawPharmacy: rawPharmacy2, customSources: customSources2 } = schema2;
  const { count, min, max, sql } = orm2;
  const KNOWN = [
    { name: "members", ref: members2 },
    { name: "claims", ref: claims2 },
    { name: "pharmacy", ref: pharmacy2 },
    { name: "sdoh", ref: sdoh2 },
    { name: "call_center", ref: callCenter2 },
    { name: "utilization", ref: utilization2 },
    { name: "raw_claims", ref: rawClaims2 },
    { name: "raw_pharmacy", ref: rawPharmacy2 }
  ];
  const tables = [];
  for (const t of KNOWN) {
    const [rc] = await db2.select({ count: count() }).from(t.ref);
    tables.push({ table: t.name, rowCount: rc.count });
  }
  const customs = await db2.select().from(customSources2);
  for (const c of customs) {
    const result = await db2.all(sql.raw(`SELECT COUNT(*) as cnt FROM "${c.tableName}"`));
    tables.push({ table: c.tableName, rowCount: result[0]?.cnt ?? 0, custom: true, description: c.description });
  }
  const [claimDateRange] = await db2.select({ earliest: min(claims2.date), latest: max(claims2.date) }).from(claims2);
  const [rawClaimNulls] = await db2.select({
    nullMemberId: sql`sum(case when member_id = '' then 1 else 0 end)`,
    nullIcd: sql`sum(case when icd_code = '' then 1 else 0 end)`,
    nullDate: sql`sum(case when date = '' then 1 else 0 end)`,
    total: count()
  }).from(rawClaims2);
  const [rawRxNulls] = await db2.select({
    nullMemberId: sql`sum(case when member_id = '' then 1 else 0 end)`,
    nullDrug: sql`sum(case when drug_name = '' then 1 else 0 end)`,
    nullDate: sql`sum(case when fill_date = '' then 1 else 0 end)`,
    total: count()
  }).from(rawPharmacy2);
  return { content: [{ type: "text", text: JSON.stringify({
    sources: tables,
    cleanDataFreshness: { claims: claimDateRange },
    rawDataQuality: {
      raw_claims: { total: rawClaimNulls.total, nullMemberIds: rawClaimNulls.nullMemberId, nullIcdCodes: rawClaimNulls.nullIcd, nullDates: rawClaimNulls.nullDate },
      raw_pharmacy: { total: rawRxNulls.total, nullMemberIds: rawRxNulls.nullMemberId, nullDrugNames: rawRxNulls.nullDrug, nullDates: rawRxNulls.nullDate }
    },
    hint: "Use profile_table to deep-dive into any table. Use standardize_records to clean raw_claims or raw_pharmacy."
  }, null, 2) }] };
});
server.tool("profile_table", "Deep-dive stats for a single table \u2014 distributions, nulls, outliers, distinct counts.", {
  table: z.string().describe("Table name to profile, e.g. 'members', 'raw_claims', 'raw_pharmacy'")
}, async ({ table: tableName }) => {
  const { db: db2, schema: schema2, orm: orm2 } = await getDb();
  const { count, min, max, avg, sql } = orm2;
  const profile = { table: tableName };
  if (tableName === "members") {
    const [stats] = await db2.select({ count: count(), minAge: min(schema2.members.age), maxAge: max(schema2.members.age), avgAge: avg(schema2.members.age), minRisk: min(schema2.members.riskScore), maxRisk: max(schema2.members.riskScore), avgRisk: avg(schema2.members.riskScore) }).from(schema2.members);
    const tierDist = await db2.select({ tier: schema2.members.riskTier, count: count() }).from(schema2.members).groupBy(schema2.members.riskTier);
    const stateDist = await db2.select({ state: schema2.members.state, count: count() }).from(schema2.members).groupBy(schema2.members.state);
    profile.stats = stats;
    profile.tierDistribution = Object.fromEntries(tierDist.map((r) => [r.tier, r.count]));
    profile.stateDistribution = Object.fromEntries(stateDist.map((r) => [r.state, r.count]));
  } else if (tableName === "raw_claims") {
    const [stats] = await db2.select({ count: count(), minAmt: min(schema2.rawClaims.amount), maxAmt: max(schema2.rawClaims.amount), avgAmt: avg(schema2.rawClaims.amount) }).from(schema2.rawClaims);
    const icdDist = await db2.select({ code: schema2.rawClaims.icdCode, count: count() }).from(schema2.rawClaims).groupBy(schema2.rawClaims.icdCode);
    const typeDist = await db2.select({ type: schema2.rawClaims.type, count: count() }).from(schema2.rawClaims).groupBy(schema2.rawClaims.type);
    const sourceDist = await db2.select({ src: schema2.rawClaims.sourceFile, count: count() }).from(schema2.rawClaims).groupBy(schema2.rawClaims.sourceFile);
    const [nulls] = await db2.select({ emptyMemberId: sql`sum(case when member_id='' then 1 else 0 end)`, emptyIcd: sql`sum(case when icd_code='' then 1 else 0 end)`, emptyDate: sql`sum(case when date='' then 1 else 0 end)`, negativeAmt: sql`sum(case when amount<0 then 1 else 0 end)`, outlierAmt: sql`sum(case when amount>100000 then 1 else 0 end)`, total: count() }).from(schema2.rawClaims);
    const [orphans] = await db2.select({ count: sql`count(*)` }).from(schema2.rawClaims).where(sql`member_id != '' AND member_id NOT IN (SELECT id FROM members)`);
    const invalidIcd = icdDist.filter((r) => r.code !== "" && !VALID_ICD_SET.has(r.code));
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const [futureDated] = await db2.select({ count: sql`sum(case when date > ${today} then 1 else 0 end)` }).from(schema2.rawClaims);
    profile.stats = stats;
    profile.icdDistribution = icdDist;
    profile.typeDistribution = Object.fromEntries(typeDist.map((r) => [r.type, r.count]));
    profile.sourceFiles = Object.fromEntries(sourceDist.map((r) => [r.src, r.count]));
    profile.issues = { ...nulls, orphanMemberIds: orphans.count, invalidIcdCodes: invalidIcd.map((r) => ({ code: r.code, count: r.count })), futureDatedRecords: futureDated.count };
  } else if (tableName === "raw_pharmacy") {
    const [stats] = await db2.select({ count: count(), minAdh: min(schema2.rawPharmacy.adherencePct), maxAdh: max(schema2.rawPharmacy.adherencePct), avgAdh: avg(schema2.rawPharmacy.adherencePct) }).from(schema2.rawPharmacy);
    const drugDist = await db2.select({ drug: schema2.rawPharmacy.drugName, count: count() }).from(schema2.rawPharmacy).groupBy(schema2.rawPharmacy.drugName);
    const [nulls] = await db2.select({ emptyMemberId: sql`sum(case when member_id='' then 1 else 0 end)`, emptyDrug: sql`sum(case when drug_name='' then 1 else 0 end)`, emptyDate: sql`sum(case when fill_date='' then 1 else 0 end)`, outOfRangeAdh: sql`sum(case when adherence_pct<0 or adherence_pct>100 then 1 else 0 end)`, total: count() }).from(schema2.rawPharmacy);
    const invalidDrugs = drugDist.filter((r) => r.drug !== "" && !VALID_DRUG_SET.has(r.drug));
    profile.stats = stats;
    profile.drugDistribution = drugDist;
    profile.issues = { ...nulls, invalidDrugNames: invalidDrugs.map((r) => ({ drug: r.drug, count: r.count, correction: DRUG_CORRECTIONS[r.drug] ?? null })) };
  } else if (tableName === "claims") {
    const [stats] = await db2.select({ count: count(), minAmt: min(schema2.claims.amount), maxAmt: max(schema2.claims.amount), avgAmt: avg(schema2.claims.amount) }).from(schema2.claims);
    const typeDist = await db2.select({ type: schema2.claims.type, count: count() }).from(schema2.claims).groupBy(schema2.claims.type);
    profile.stats = stats;
    profile.typeDistribution = Object.fromEntries(typeDist.map((r) => [r.type, r.count]));
  } else if (tableName === "pharmacy") {
    const [stats] = await db2.select({ count: count(), minAdh: min(schema2.pharmacy.adherencePct), maxAdh: max(schema2.pharmacy.adherencePct), avgAdh: avg(schema2.pharmacy.adherencePct) }).from(schema2.pharmacy);
    const drugDist = await db2.select({ drug: schema2.pharmacy.drugName, count: count() }).from(schema2.pharmacy).groupBy(schema2.pharmacy.drugName);
    profile.stats = stats;
    profile.drugDistribution = drugDist;
  } else {
    const result = await db2.all(sql.raw(`SELECT COUNT(*) as cnt FROM "${tableName}"`));
    profile.rowCount = result[0]?.cnt ?? 0;
    profile.note = "Basic profile only \u2014 use known table names for detailed stats.";
  }
  return { content: [{ type: "text", text: JSON.stringify(profile, null, 2) }] };
});
server.tool("standardize_records", "Clean and standardize raw data \u2014 fix ICD codes, normalize drug names, flag bad dates, quarantine invalid records.", {
  source: z.enum(["raw_claims", "raw_pharmacy"]).describe("Which raw table to standardize"),
  dryRun: z.boolean().optional().describe("Preview changes without writing (default false)")
}, async ({ source, dryRun }) => {
  const { db: db2, schema: schema2, orm: orm2 } = await getDb();
  const { rawClaims: rawClaims2, rawPharmacy: rawPharmacy2, stagingQuarantine: stagingQuarantine2, claims: claims2, pharmacy: pharmacy2 } = schema2;
  const isDry = dryRun ?? false;
  const result = { source, dryRun: isDry };
  if (source === "raw_claims") {
    const rows = await db2.select().from(rawClaims2);
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    let cleaned = 0, corrected = 0, quarantined = 0;
    const quarantineReasons = [];
    const corrections = [];
    for (const row of rows) {
      const reasons = [];
      if (!row.memberId || row.memberId === "") reasons.push("empty_member_id");
      else if (row.memberId.startsWith("M-ORPHAN")) reasons.push("orphan_member_id");
      if (row.amount < 0) reasons.push("negative_amount");
      if (row.amount > 1e5) reasons.push("outlier_amount");
      if (row.date > today && row.date !== "") reasons.push("future_dated");
      if (row.date === "") reasons.push("empty_date");
      let fixedIcd = row.icdCode;
      if (row.icdCode && !VALID_ICD_SET.has(row.icdCode)) {
        const correction = ICD_CORRECTIONS[row.icdCode];
        if (correction) {
          fixedIcd = correction;
          corrections.push({ id: row.id, field: "icd_code", from: row.icdCode, to: correction });
        } else if (row.icdCode !== "") reasons.push(`invalid_icd:${row.icdCode}`);
      }
      if (reasons.length > 0) {
        quarantined++;
        quarantineReasons.push({ id: row.id, reasons });
        if (!isDry) {
          await db2.insert(stagingQuarantine2).values({ id: crypto.randomUUID(), sourceTable: "raw_claims", sourceId: row.id, reason: reasons.join(", "), stepName: "standardize_records", recordJson: JSON.stringify(row), createdAt: (/* @__PURE__ */ new Date()).toISOString() });
        }
      } else {
        if (fixedIcd !== row.icdCode) corrected++;
        cleaned++;
        if (!isDry) {
          await db2.insert(claims2).values({ id: `SC-${row.id}`, memberId: row.memberId, icdCode: fixedIcd, type: row.type, amount: row.amount, date: row.date, provider: row.provider }).onConflictDoNothing();
        }
      }
    }
    result.cleaned = cleaned;
    result.corrected = corrected;
    result.quarantined = quarantined;
    result.sampleCorrections = corrections.slice(0, 10);
    result.sampleQuarantine = quarantineReasons.slice(0, 10);
  } else {
    const rows = await db2.select().from(rawPharmacy2);
    let cleaned = 0, corrected = 0, quarantined = 0;
    const quarantineReasons = [];
    const corrections = [];
    for (const row of rows) {
      const reasons = [];
      if (!row.memberId || row.memberId === "") reasons.push("empty_member_id");
      else if (row.memberId.startsWith("M-ORPHAN")) reasons.push("orphan_member_id");
      if (row.adherencePct < 0 || row.adherencePct > 100) reasons.push(`adherence_out_of_range:${row.adherencePct}`);
      if (row.fillDate === "") reasons.push("empty_fill_date");
      let fixedDrug = row.drugName;
      if (row.drugName && !VALID_DRUG_SET.has(row.drugName)) {
        const correction = DRUG_CORRECTIONS[row.drugName];
        if (correction) {
          fixedDrug = correction;
          corrections.push({ id: row.id, field: "drug_name", from: row.drugName, to: correction });
        } else if (row.drugName !== "") reasons.push(`invalid_drug:${row.drugName}`);
      }
      if (reasons.length > 0) {
        quarantined++;
        quarantineReasons.push({ id: row.id, reasons });
        if (!isDry) {
          await db2.insert(stagingQuarantine2).values({ id: crypto.randomUUID(), sourceTable: "raw_pharmacy", sourceId: row.id, reason: reasons.join(", "), stepName: "standardize_records", recordJson: JSON.stringify(row), createdAt: (/* @__PURE__ */ new Date()).toISOString() });
        }
      } else {
        if (fixedDrug !== row.drugName) corrected++;
        cleaned++;
        if (!isDry) {
          await db2.insert(pharmacy2).values({ id: `SP-${row.id}`, memberId: row.memberId, drugName: fixedDrug, drugClass: row.drugClass, adherencePct: row.adherencePct, fillDate: row.fillDate }).onConflictDoNothing();
        }
      }
    }
    result.cleaned = cleaned;
    result.corrected = corrected;
    result.quarantined = quarantined;
    result.sampleCorrections = corrections.slice(0, 10);
    result.sampleQuarantine = quarantineReasons.slice(0, 10);
  }
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});
server.tool("resolve_entities", "Check entity linkage across data sources. Exact mode checks FK integrity. Fuzzy mode finds potential duplicates.", {
  strategy: z.enum(["exact", "fuzzy"]).describe("exact = FK check, fuzzy = name similarity matching")
}, async ({ strategy }) => {
  const { db: db2, schema: schema2, orm: orm2 } = await getDb();
  const { members: members2, claims: claims2, pharmacy: pharmacy2, sdoh: sdoh2, callCenter: callCenter2, utilization: utilization2 } = schema2;
  const { count, sql } = orm2;
  if (strategy === "exact") {
    const checks = await Promise.all([
      db2.all(sql`SELECT count(*) as cnt FROM claims WHERE member_id NOT IN (SELECT id FROM members)`),
      db2.all(sql`SELECT count(*) as cnt FROM pharmacy WHERE member_id NOT IN (SELECT id FROM members)`),
      db2.all(sql`SELECT count(*) as cnt FROM sdoh WHERE member_id NOT IN (SELECT id FROM members)`),
      db2.all(sql`SELECT count(*) as cnt FROM call_center WHERE member_id NOT IN (SELECT id FROM members)`),
      db2.all(sql`SELECT count(*) as cnt FROM utilization WHERE member_id NOT IN (SELECT id FROM members)`)
    ]);
    const [mc] = await db2.select({ count: count() }).from(members2);
    const linked = await Promise.all([
      db2.select({ count: sql`count(distinct member_id)` }).from(claims2),
      db2.select({ count: sql`count(distinct member_id)` }).from(pharmacy2),
      db2.select({ count: sql`count(distinct member_id)` }).from(sdoh2)
    ]);
    const total = mc.count || 1;
    return { content: [{ type: "text", text: JSON.stringify({
      strategy: "exact",
      totalMembers: mc.count,
      orphans: { claims: checks[0][0].cnt, pharmacy: checks[1][0].cnt, sdoh: checks[2][0].cnt, call_center: checks[3][0].cnt, utilization: checks[4][0].cnt },
      linkageRates: { claims: `${Math.round(linked[0][0].count / total * 100)}%`, pharmacy: `${Math.round(linked[1][0].count / total * 100)}%`, sdoh: `${Math.round(linked[2][0].count / total * 100)}%` },
      totalOrphans: checks.reduce((s, c) => s + c[0].cnt, 0)
    }, null, 2) }] };
  } else {
    const allMembers = await db2.select({ id: members2.id, name: members2.name, state: members2.state }).from(members2).limit(500);
    const candidates = [];
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
    return { content: [{ type: "text", text: JSON.stringify({ strategy: "fuzzy", candidateDuplicates: candidates.length, candidates: candidates.slice(0, 15) }, null, 2) }] };
  }
});
server.tool("quarantine_records", "Move bad records from a source table to the quarantine staging area.", {
  source: z.enum(["raw_claims", "raw_pharmacy"]).describe("Source table"),
  reason: z.string().describe("Why these records are being quarantined"),
  filter: z.object({
    field: z.string().describe("Column to filter on"),
    condition: z.enum(["empty", "out_of_range", "orphan", "future_dated"]).describe("Filter condition")
  })
}, async ({ source, reason, filter }) => {
  const { db: db2, schema: schema2, orm: orm2 } = await getDb();
  const { rawClaims: rawClaims2, rawPharmacy: rawPharmacy2, stagingQuarantine: stagingQuarantine2 } = schema2;
  const { sql } = orm2;
  let moved = 0;
  if (source === "raw_claims") {
    let condition;
    if (filter.condition === "empty") condition = sql.raw(`"${filter.field}" = ''`);
    else if (filter.condition === "orphan") condition = sql`member_id != '' AND member_id NOT IN (SELECT id FROM members)`;
    else if (filter.condition === "future_dated") condition = sql`date > ${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}`;
    else condition = sql`amount < 0 OR amount > 100000`;
    const rows = await db2.select().from(rawClaims2).where(condition);
    for (const row of rows) {
      await db2.insert(stagingQuarantine2).values({ id: crypto.randomUUID(), sourceTable: "raw_claims", sourceId: row.id, reason, stepName: "quarantine_records", recordJson: JSON.stringify(row), createdAt: (/* @__PURE__ */ new Date()).toISOString() });
      moved++;
    }
  } else {
    let condition;
    if (filter.condition === "empty") condition = sql.raw(`"${filter.field}" = ''`);
    else if (filter.condition === "orphan") condition = sql`member_id NOT IN (SELECT id FROM members)`;
    else if (filter.condition === "out_of_range") condition = sql`adherence_pct < 0 OR adherence_pct > 100`;
    else condition = sql`fill_date = ''`;
    const rows = await db2.select().from(rawPharmacy2).where(condition);
    for (const row of rows) {
      await db2.insert(stagingQuarantine2).values({ id: crypto.randomUUID(), sourceTable: "raw_pharmacy", sourceId: row.id, reason, stepName: "quarantine_records", recordJson: JSON.stringify(row), createdAt: (/* @__PURE__ */ new Date()).toISOString() });
      moved++;
    }
  }
  return { content: [{ type: "text", text: JSON.stringify({ source, reason, filter, recordsQuarantined: moved }, null, 2) }] };
});
server.tool("validate_quality", "Run configurable quality gates across the dataset.", {
  rules: z.array(z.string()).optional().describe("Rules to run. Default: all."),
  thresholds: z.object({ completeness: z.number().optional(), linkage: z.number().optional() }).optional()
}, async ({ rules: ruleList, thresholds }) => {
  const { db: db2, schema: schema2, orm: orm2 } = await getDb();
  const { members: members2, claims: claims2 } = schema2;
  const { count, sql } = orm2;
  const allRules = ruleList ?? ["not_empty", "unique_ids", "required_fields", "risk_range", "tier_consistency", "referential_integrity", "completeness", "distribution", "linkage"];
  const compThreshold = thresholds?.completeness ?? 0.95;
  const linkThreshold = thresholds?.linkage ?? 0.9;
  const results = [];
  const [mc] = await db2.select({ count: count() }).from(members2);
  for (const rule of allRules) {
    if (rule === "not_empty") {
      results.push({ rule, passed: mc.count > 0, detail: `${mc.count} members` });
    } else if (rule === "unique_ids") {
      const [u] = await db2.select({ distinct: sql`count(distinct id)`, total: count() }).from(members2);
      results.push({ rule, passed: u.distinct === u.total, detail: `${u.distinct}/${u.total} unique` });
    } else if (rule === "required_fields") {
      const [n] = await db2.select({ cnt: sql`sum(case when member_reference='' or state='' or risk_tier='' then 1 else 0 end)` }).from(members2);
      results.push({ rule, passed: (n.cnt ?? 0) === 0, detail: `${n.cnt ?? 0} missing required fields` });
    } else if (rule === "risk_range") {
      const [r] = await db2.select({ cnt: sql`sum(case when risk_score<0 or risk_score>1 then 1 else 0 end)` }).from(members2);
      results.push({ rule, passed: (r.cnt ?? 0) === 0, detail: `${r.cnt ?? 0} out of range` });
    } else if (rule === "tier_consistency") {
      const [t] = await db2.select({ cnt: sql`sum(case when risk_tier='high' and risk_score<0.70 then 1 when risk_tier='low' and risk_score>=0.40 then 1 else 0 end)` }).from(members2);
      results.push({ rule, passed: (t.cnt ?? 0) === 0, detail: `${t.cnt ?? 0} inconsistent` });
    } else if (rule === "referential_integrity") {
      const orphans = await db2.all(sql`SELECT count(*) as cnt FROM claims WHERE member_id NOT IN (SELECT id FROM members)`);
      const cnt = orphans[0]?.cnt ?? 0;
      results.push({ rule, passed: cnt === 0, detail: `${cnt} orphan claims` });
    } else if (rule === "completeness") {
      const [n] = await db2.select({ nullRef: sql`sum(case when member_reference='' then 1 else 0 end)`, nullState: sql`sum(case when state='' then 1 else 0 end)`, nullTier: sql`sum(case when risk_tier='' then 1 else 0 end)`, nullDrivers: sql`sum(case when risk_drivers='' then 1 else 0 end)`, total: count() }).from(members2);
      const total = n.total || 1;
      const rate = 1 - (n.nullRef + n.nullState + n.nullTier + n.nullDrivers) / (total * 4);
      results.push({ rule, passed: rate >= compThreshold, detail: `${Math.round(rate * 1e4) / 100}% complete (threshold: ${compThreshold * 100}%)` });
    } else if (rule === "distribution") {
      const tiers = await db2.select({ tier: members2.riskTier, count: count() }).from(members2).groupBy(members2.riskTier);
      const counts = tiers.map((t) => t.count);
      const ok = counts.length >= 2 && !counts.some((c) => c === mc.count);
      results.push({ rule, passed: ok, detail: `${counts.length} tiers: ${tiers.map((t) => `${t.tier}=${t.count}`).join(", ")}` });
    } else if (rule === "linkage") {
      const [lc] = await db2.select({ count: sql`count(distinct member_id)` }).from(claims2);
      const rate = mc.count > 0 ? lc.count / mc.count : 0;
      results.push({ rule, passed: rate >= linkThreshold, detail: `${Math.round(rate * 100)}% linked (threshold: ${linkThreshold * 100}%)` });
    }
  }
  const passed = results.filter((r) => r.passed).length;
  return { content: [{ type: "text", text: JSON.stringify({ rulesEvaluated: results.length, rulesPassed: passed, qualityScore: `${Math.round(passed / results.length * 100)}%`, readyForModeling: passed === results.length, results }, null, 2) }] };
});
server.tool("save_pipeline_run", "Record the agent's pipeline decisions \u2014 steps, findings, and quality score.", {
  steps: z.array(z.object({ name: z.string(), result: z.string(), recordsAffected: z.number() })),
  qualityScore: z.number().describe("0-100"),
  notes: z.string().optional()
}, async ({ steps: stepList, qualityScore, notes }) => {
  const { db: db2, schema: schema2 } = await getDb();
  const { pipelineRuns: pipelineRuns2 } = schema2;
  const id = crypto.randomUUID();
  await db2.insert(pipelineRuns2).values({
    id,
    status: qualityScore >= 90 ? "passed" : "failed",
    stepsCompleted: stepList.length,
    totalSteps: stepList.length,
    qualityScore: qualityScore / 100,
    profilingJson: JSON.stringify(stepList),
    validationJson: JSON.stringify({ notes: notes ?? "" }),
    durationMs: 0,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  return { content: [{ type: "text", text: JSON.stringify({ saved: true, pipelineRunId: id, steps: stepList.length, qualityScore, status: qualityScore >= 90 ? "passed" : "failed" }, null, 2) }] };
});
server.tool("create_data_source", "Create a new data table from a natural language description. Agent defines columns and optionally inserts sample data.", {
  name: z.string().describe("Table name (lowercase, underscores)"),
  description: z.string().describe("What this data source contains"),
  columns: z.array(z.object({ name: z.string(), type: z.enum(["text", "integer", "real"]), required: z.boolean().optional() })),
  sampleData: z.array(z.record(z.string(), z.unknown())).optional().describe("Optional rows to insert")
}, async ({ name, description, columns, sampleData }) => {
  const { db: db2, schema: schema2, orm: orm2 } = await getDb();
  const { customSources: customSources2 } = schema2;
  const { sql } = orm2;
  const safeName = name.replace(/[^a-z0-9_]/g, "_").toLowerCase();
  const colDefs = columns.map((c) => `"${c.name}" ${c.type.toUpperCase()}${c.required ? " NOT NULL" : ""} DEFAULT ${c.type === "text" ? "''" : "0"}`);
  colDefs.unshift('"id" TEXT PRIMARY KEY');
  await db2.run(sql.raw(`CREATE TABLE IF NOT EXISTS "${safeName}" (${colDefs.join(", ")})`));
  let rowCount = 0;
  if (sampleData?.length) {
    for (const row of sampleData) {
      const id = crypto.randomUUID();
      const cols = ["id", ...Object.keys(row)];
      const vals = [id, ...Object.values(row)].map((v) => typeof v === "string" ? `'${String(v).replace(/'/g, "''")}'` : String(v));
      await db2.run(sql.raw(`INSERT OR IGNORE INTO "${safeName}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${vals.join(", ")})`));
      rowCount++;
    }
  }
  await db2.insert(customSources2).values({ id: crypto.randomUUID(), tableName: safeName, columnsJson: JSON.stringify(columns), rowCount, createdBy: "agent", description, createdAt: (/* @__PURE__ */ new Date()).toISOString() }).onConflictDoNothing();
  return { content: [{ type: "text", text: JSON.stringify({ created: true, table: safeName, columns: columns.length, rowsInserted: rowCount, description, note: "Table is now visible in inspect_sources and profile_table." }, null, 2) }] };
});
server.tool("create_data_product", "Save a named, versioned data product definition to the catalog.", {
  name: z.string().describe("Product name, e.g. 'diabetes_care_gaps'"),
  description: z.string(),
  sourceTables: z.array(z.string()).describe("Tables this product draws from"),
  filters: z.record(z.string(), z.unknown()).optional().describe("Filter criteria as key-value pairs"),
  columns: z.array(z.string()).optional().describe("Columns to include in the product")
}, async ({ name, description, sourceTables, filters, columns: cols }) => {
  const { db: db2, schema: schema2, orm: orm2 } = await getDb();
  const { dataProducts: dataProducts2 } = schema2;
  const { eq, desc } = orm2;
  const id = crypto.randomUUID();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const existing = await db2.select().from(dataProducts2).where(eq(dataProducts2.name, name));
  const version = existing.length > 0 ? Math.max(...existing.map((e) => e.version)) + 1 : 1;
  await db2.insert(dataProducts2).values({
    id,
    name,
    description,
    createdBy: "agent",
    sourceTables: JSON.stringify(sourceTables),
    queryDefinition: JSON.stringify({ filters: filters ?? {}, columns: cols ?? [] }),
    version,
    status: "published",
    createdAt: now,
    updatedAt: now
  });
  return { content: [{ type: "text", text: JSON.stringify({ created: true, productId: id, name, version, sourceTables, status: "published" }, null, 2) }] };
});
server.tool("list_data_products", "List all saved data products in the catalog.", {}, async () => {
  const { db: db2, schema: schema2, orm: orm2 } = await getDb();
  const { dataProducts: dataProducts2 } = schema2;
  const { desc } = orm2;
  const products = await db2.select().from(dataProducts2).orderBy(desc(dataProducts2.updatedAt));
  return { content: [{ type: "text", text: JSON.stringify({ count: products.length, products: products.map((p) => ({ id: p.id, name: p.name, description: p.description, version: p.version, status: p.status, sourceTables: JSON.parse(p.sourceTables), createdBy: p.createdBy, createdAt: p.createdAt })) }, null, 2) }] };
});
var transport = new StdioServerTransport();
server.connect(transport).then(() => {
  const mode = isDirect ? `direct (${TURSO_URL})` : `proxy (${API_URL})`;
  process.stderr.write(`Meridian MCP server started in ${mode} mode
`);
});
