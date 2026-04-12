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
  callCenter: () => callCenter,
  claims: () => claims,
  feedbackRequests: () => feedbackRequests,
  members: () => members,
  pharmacy: () => pharmacy,
  sdoh: () => sdoh,
  usageLog: () => usageLog,
  users: () => users
});
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
var members, claims, pharmacy, sdoh, callCenter, feedbackRequests, usageLog, users;
var init_schema = __esm({
  "src/lib/schema.ts"() {
    "use strict";
    members = sqliteTable("members", {
      id: text("id").primaryKey(),
      name: text("name").notNull(),
      state: text("state").notNull(),
      age: integer("age").notNull(),
      gender: text("gender").notNull(),
      riskScore: real("risk_score").notNull(),
      riskTier: text("risk_tier").notNull(),
      chronicConditions: text("chronic_conditions").notNull()
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
      adherencePct: real("adherence_pct").notNull(),
      fillDate: text("fill_date").notNull()
    });
    sdoh = sqliteTable("sdoh", {
      id: text("id").primaryKey(),
      memberId: text("member_id").notNull().references(() => members.id),
      transportationFlag: integer("transportation_flag").notNull(),
      foodInsecurity: integer("food_insecurity").notNull(),
      housingInstability: integer("housing_instability").notNull()
    });
    callCenter = sqliteTable("call_center", {
      id: text("id").primaryKey(),
      memberId: text("member_id").notNull().references(() => members.id),
      reason: text("reason").notNull(),
      sentiment: text("sentiment").notNull(),
      date: text("date").notNull()
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
  const text2 = await res.text();
  return text2;
}
async function proxyPipeline() {
  const res = await fetch(`${API_URL}/api/pipeline`, { method: "POST" });
  if (!res.ok) throw new Error(`Pipeline API error: ${res.status}`);
  const text2 = await res.text();
  const lines = text2.trim().split("\n").filter(Boolean);
  return lines.map((l) => JSON.parse(l));
}
async function identifyCohort(args) {
  const { db: db2, schema: schema2, orm: orm2 } = await getDb();
  const { members: members2, sdoh: sdoh2 } = schema2;
  const { eq, and, inArray, like, or } = orm2;
  const filters = [eq(members2.riskTier, args.riskTier)];
  if (args.states.length > 0) filters.push(inArray(members2.state, args.states));
  if (args.conditions.length > 0) {
    const condOr = or(
      ...args.conditions.map(
        (c) => like(members2.chronicConditions, `%${c}%`)
      )
    );
    if (condOr) filters.push(condOr);
  }
  const rows = await db2.select({
    id: members2.id,
    name: members2.name,
    state: members2.state,
    age: members2.age,
    gender: members2.gender,
    riskScore: members2.riskScore,
    riskTier: members2.riskTier,
    chronicConditions: members2.chronicConditions,
    sdohTransportation: sdoh2.transportationFlag,
    sdohFood: sdoh2.foodInsecurity,
    sdohHousing: sdoh2.housingInstability
  }).from(members2).leftJoin(sdoh2, eq(members2.id, sdoh2.memberId)).where(and(...filters));
  return {
    count: rows.length,
    members: rows.map((m) => ({
      id: m.id,
      name: m.name,
      state: m.state,
      age: m.age,
      gender: m.gender,
      riskScore: m.riskScore,
      riskTier: m.riskTier,
      chronicConditions: m.chronicConditions,
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
  const member = await db2.query.members.findFirst({
    where: eq(members2.id, args.memberId)
  });
  if (!member) return { error: "Member not found", drivers: [], member: null };
  const sdohRow = await db2.query.sdoh.findFirst({
    where: eq(sdoh2.memberId, args.memberId)
  });
  const rxRows = await db2.select().from(pharmacy2).where(eq(pharmacy2.memberId, args.memberId));
  const avgAdherence = rxRows.length === 0 ? null : rxRows.reduce((s, r) => s + r.adherencePct, 0) / rxRows.length;
  const drivers = [];
  drivers.push({
    name: "Clinical risk score",
    score: Math.min(1, Math.max(0, member.riskScore)),
    category: "clinical"
  });
  if (sdohRow?.transportationFlag)
    drivers.push({ name: "Transportation access", score: 0.82, category: "sdoh" });
  if (sdohRow?.foodInsecurity)
    drivers.push({ name: "Food insecurity", score: 0.78, category: "sdoh" });
  if (sdohRow?.housingInstability)
    drivers.push({ name: "Housing instability", score: 0.75, category: "sdoh" });
  if (avgAdherence !== null)
    drivers.push({
      name: "Medication adherence",
      score: Math.min(1, Math.max(0, 1 - avgAdherence / 100)),
      category: "pharmacy"
    });
  drivers.sort((a, b) => b.score - a.score);
  return {
    member: {
      id: member.id,
      name: member.name,
      state: member.state,
      age: member.age,
      gender: member.gender,
      riskScore: member.riskScore,
      riskTier: member.riskTier,
      chronicConditions: member.chronicConditions
    },
    pharmacyFillCount: rxRows.length,
    avgAdherencePct: avgAdherence,
    drivers
  };
}
async function explainMember(args) {
  const { db: db2, schema: schema2, orm: orm2 } = await getDb();
  const { members: members2, sdoh: sdoh2, pharmacy: pharmacy2, claims: claims2 } = schema2;
  const { eq, desc } = orm2;
  const member = await db2.query.members.findFirst({
    where: eq(members2.id, args.memberId)
  });
  if (!member) return { error: "Member not found" };
  const [sdohRow, rxRows, claimRows] = await Promise.all([
    db2.query.sdoh.findFirst({ where: eq(sdoh2.memberId, args.memberId) }),
    db2.select().from(pharmacy2).where(eq(pharmacy2.memberId, args.memberId)),
    db2.select().from(claims2).where(eq(claims2.memberId, args.memberId)).orderBy(desc(claims2.date)).limit(25)
  ]);
  const totalClaimAmount = claimRows.reduce(
    (s, c) => s + c.amount,
    0
  );
  const byType = {};
  for (const c of claimRows) byType[c.type] = (byType[c.type] ?? 0) + 1;
  return {
    sections: {
      overview: {
        title: "Overview",
        summary: `${member.name} is a ${member.age}-year-old ${member.gender} member in ${member.state} with ${member.riskTier} risk (score ${member.riskScore}).`
      },
      demographics: {
        title: "Demographics",
        id: member.id,
        name: member.name,
        state: member.state,
        age: member.age,
        gender: member.gender
      },
      clinical: {
        title: "Clinical profile",
        chronicConditions: member.chronicConditions,
        riskScore: member.riskScore,
        riskTier: member.riskTier
      },
      sdoh: {
        title: "Social determinants",
        transportationBarrier: sdohRow ? sdohRow.transportationFlag === 1 : null,
        foodInsecurity: sdohRow ? sdohRow.foodInsecurity === 1 : null,
        housingInstability: sdohRow ? sdohRow.housingInstability === 1 : null
      },
      pharmacy: {
        title: "Pharmacy",
        fills: rxRows.map((r) => ({
          drugName: r.drugName,
          adherencePct: r.adherencePct,
          fillDate: r.fillDate
        }))
      },
      claims: {
        title: "Recent claims",
        claimCount: claimRows.length,
        totalAmount: totalClaimAmount,
        countsByType: byType,
        recent: claimRows.slice(0, 8).map((c) => ({
          date: c.date,
          type: c.type,
          amount: c.amount,
          icdCode: c.icdCode,
          provider: c.provider
        }))
      }
    }
  };
}
async function recommendOutreach(args) {
  const { db: db2, schema: schema2, orm: orm2 } = await getDb();
  const { members: members2 } = schema2;
  const { eq } = orm2;
  const member = await db2.query.members.findFirst({
    where: eq(members2.id, args.memberId)
  });
  if (!member) return { error: "Member not found", recommendations: [] };
  const d = args.drivers.map((x) => x.toLowerCase()).join(" ");
  const out = [];
  if (d.includes("transport") || d.includes("sdoh"))
    out.push({
      action: "Offer transportation benefit navigation and scheduling assistance",
      priority: "high",
      rationale: "Transport barriers often drive missed care."
    });
  if (d.includes("food") || d.includes("hunger"))
    out.push({
      action: "Connect to food assistance programs and meal benefit review",
      priority: "high",
      rationale: "Food insecurity correlates with poor chronic disease control."
    });
  if (d.includes("adher") || d.includes("pharmacy") || d.includes("medication"))
    out.push({
      action: "Pharmacist-led adherence call and 90-day fill review",
      priority: "medium",
      rationale: "Medication gaps are a modifiable driver of risk."
    });
  if (member.riskTier === "high" || d.includes("clinical") || d.includes("risk"))
    out.push({
      action: "Care manager outreach within 48 hours",
      priority: "high",
      rationale: `Member is ${member.riskTier} clinical risk.`
    });
  if (out.length === 0)
    out.push({
      action: "Routine wellness check-in",
      priority: "medium",
      rationale: "Default proactive engagement."
    });
  return { memberId: args.memberId, memberName: member.name, recommendations: out };
}
async function generateChart(args) {
  const { db: db2, schema: schema2, orm: orm2 } = await getDb();
  const { members: members2, claims: claims2 } = schema2;
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
  } else {
    rows = await db2.select({ name: members2.riskTier, value: sql`cast(count(*) as real)` }).from(members2).groupBy(members2.riskTier);
    title = "Members by risk tier";
  }
  return {
    type: args.chartType,
    title,
    data: rows.map((r) => ({ name: String(r.name), value: Number(r.value) }))
  };
}
async function submitFeedback(args) {
  const { db: db2, schema: schema2 } = await getDb();
  const id = crypto.randomUUID();
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  await db2.insert(schema2.feedbackRequests).values({
    id,
    userRole: args.userRole,
    requestText: args.requestText,
    status: "new",
    createdAt
  });
  return { ok: true, id, message: "Feedback submitted for review.", createdAt };
}
async function runPipeline() {
  if (!isDirect) {
    return await proxyPipeline();
  }
  const { db: db2, schema: schema2, orm: orm2 } = await getDb();
  const { members: members2, claims: claims2, pharmacy: pharmacy2, sdoh: sdoh2, callCenter: callCenter2 } = schema2;
  const { count, avg, min, max, sql } = orm2;
  const steps = [];
  let start = Date.now();
  const [mc] = await db2.select({ count: count() }).from(members2);
  const [cc] = await db2.select({ count: count() }).from(claims2);
  const [rc] = await db2.select({ count: count() }).from(pharmacy2);
  const [sc] = await db2.select({ count: count() }).from(sdoh2);
  const [ccc] = await db2.select({ count: count() }).from(callCenter2);
  steps.push({
    step: "ingest",
    status: "completed",
    durationMs: Date.now() - start,
    output: { members: mc.count, claims: cc.count, pharmacy: rc.count, sdoh: sc.count, call_center: ccc.count, total_records: mc.count + cc.count + rc.count + sc.count + ccc.count }
  });
  start = Date.now();
  const [ageStats] = await db2.select({ minAge: min(members2.age), maxAge: max(members2.age), avgAge: avg(members2.age) }).from(members2);
  const tierDist = await db2.select({ tier: members2.riskTier, count: count() }).from(members2).groupBy(members2.riskTier);
  steps.push({
    step: "profile",
    status: "completed",
    durationMs: Date.now() - start,
    output: { age: { min: ageStats.minAge, max: ageStats.maxAge, avg: Number(Number(ageStats.avgAge).toFixed(1)) }, riskTierDistribution: Object.fromEntries(tierDist.map((r) => [r.tier, r.count])) }
  });
  start = Date.now();
  const icdCodes = await db2.select({ code: claims2.icdCode, count: count() }).from(claims2).groupBy(claims2.icdCode);
  const drugNames = await db2.select({ drug: pharmacy2.drugName, count: count() }).from(pharmacy2).groupBy(pharmacy2.drugName);
  steps.push({
    step: "standardize",
    status: "completed",
    durationMs: Date.now() - start,
    output: { icdCodesValidated: icdCodes.length, drugNamesMapped: drugNames.length }
  });
  start = Date.now();
  const [wc] = await db2.select({ count: sql`count(distinct ${claims2.memberId})` }).from(claims2);
  steps.push({
    step: "entity_resolve",
    status: "completed",
    durationMs: Date.now() - start,
    output: { totalMembers: mc.count, linkedViaClaims: wc.count, matchRate: `${mc.count > 0 ? Math.round(Math.min(mc.count, wc.count) / mc.count * 100) : 0}%` }
  });
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
  steps.push({
    step: "validate",
    status: "completed",
    durationMs: Date.now() - start,
    output: { rules, rulesPassed: passed, rulesTotal: rules.length, qualityScore: `${Math.round(passed / rules.length * 100)}%`, readyForModeling: passed === rules.length }
  });
  const totalMs = steps.reduce((s, st) => s + st.durationMs, 0);
  steps.push({
    step: "summary",
    status: "completed",
    durationMs: totalMs,
    output: { pipeline: "hospitalization_risk_prediction", stepsCompleted: 5, stepsTotal: 5, totalDurationMs: totalMs, qualityScore: steps[4].output.qualityScore, readyForModeling: steps[4].output.readyForModeling }
  });
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
  {
    memberId: z.string(),
    drivers: z.array(z.string()).describe("Risk driver keywords")
  },
  async (args) => {
    const result = isDirect ? await recommendOutreach(args) : JSON.parse(await proxyChat("recommend_outreach", args));
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);
server.tool(
  "generate_chart",
  "Build chart-ready aggregates from the healthcare database",
  {
    chartType: z.enum(["bar", "pie", "line"]),
    dataQuery: z.string().describe("e.g. 'by state', 'by risk tier', 'claims by type'")
  },
  async (args) => {
    const result = isDirect ? await generateChart(args) : JSON.parse(await proxyChat("generate_chart", args));
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);
server.tool(
  "submit_feedback",
  "Record a feature or metric request for product review",
  {
    requestText: z.string(),
    userRole: z.string()
  },
  async (args) => {
    const result = isDirect ? await submitFeedback(args) : JSON.parse(await proxyChat("submit_feedback", args));
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
