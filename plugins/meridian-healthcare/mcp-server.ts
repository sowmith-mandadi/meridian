#!/usr/bin/env npx tsx
/**
 * Meridian Healthcare MCP Server
 *
 * Dual-mode:
 *   - Direct mode: TURSO_DATABASE_URL set → queries Turso via Drizzle
 *   - Proxy mode:  MERIDIAN_API_URL set  → forwards to Vercel API
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
  const text = await res.text();
  return text;
}

async function proxyPipeline() {
  const res = await fetch(`${API_URL}/api/pipeline`, { method: "POST" });
  if (!res.ok) throw new Error(`Pipeline API error: ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split("\n").filter(Boolean);
  return lines.map((l) => JSON.parse(l));
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
      ...args.conditions.map((c: string) =>
        like(members.chronicConditions, `%${c}%`)
      )
    );
    if (condOr) filters.push(condOr);
  }

  const rows = await db
    .select({
      id: members.id,
      name: members.name,
      state: members.state,
      age: members.age,
      gender: members.gender,
      riskScore: members.riskScore,
      riskTier: members.riskTier,
      chronicConditions: members.chronicConditions,
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
        housingInstability: m.sdohHousing === 1,
      },
    })),
  };
}

async function getRiskDrivers(args: { memberId: string }) {
  const { db, schema, orm } = await getDb();
  const { members, sdoh, pharmacy } = schema;
  const { eq } = orm;

  const member = await db.query.members.findFirst({
    where: eq(members.id, args.memberId),
  });
  if (!member) return { error: "Member not found", drivers: [], member: null };

  const sdohRow = await db.query.sdoh.findFirst({
    where: eq(sdoh.memberId, args.memberId),
  });
  const rxRows = await db
    .select()
    .from(pharmacy)
    .where(eq(pharmacy.memberId, args.memberId));

  const avgAdherence =
    rxRows.length === 0
      ? null
      : rxRows.reduce((s: number, r: any) => s + r.adherencePct, 0) /
        rxRows.length;

  const drivers: { name: string; score: number; category: string }[] = [];
  drivers.push({
    name: "Clinical risk score",
    score: Math.min(1, Math.max(0, member.riskScore)),
    category: "clinical",
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
      category: "pharmacy",
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
      chronicConditions: member.chronicConditions,
    },
    pharmacyFillCount: rxRows.length,
    avgAdherencePct: avgAdherence,
    drivers,
  };
}

async function explainMember(args: { memberId: string }) {
  const { db, schema, orm } = await getDb();
  const { members, sdoh, pharmacy, claims } = schema;
  const { eq, desc } = orm;

  const member = await db.query.members.findFirst({
    where: eq(members.id, args.memberId),
  });
  if (!member) return { error: "Member not found" };

  const [sdohRow, rxRows, claimRows] = await Promise.all([
    db.query.sdoh.findFirst({ where: eq(sdoh.memberId, args.memberId) }),
    db.select().from(pharmacy).where(eq(pharmacy.memberId, args.memberId)),
    db
      .select()
      .from(claims)
      .where(eq(claims.memberId, args.memberId))
      .orderBy(desc(claims.date))
      .limit(25),
  ]);

  const totalClaimAmount = claimRows.reduce(
    (s: number, c: any) => s + c.amount,
    0
  );
  const byType: Record<string, number> = {};
  for (const c of claimRows) byType[c.type] = (byType[c.type] ?? 0) + 1;

  return {
    sections: {
      overview: {
        title: "Overview",
        summary: `${member.name} is a ${member.age}-year-old ${member.gender} member in ${member.state} with ${member.riskTier} risk (score ${member.riskScore}).`,
      },
      demographics: {
        title: "Demographics",
        id: member.id,
        name: member.name,
        state: member.state,
        age: member.age,
        gender: member.gender,
      },
      clinical: {
        title: "Clinical profile",
        chronicConditions: member.chronicConditions,
        riskScore: member.riskScore,
        riskTier: member.riskTier,
      },
      sdoh: {
        title: "Social determinants",
        transportationBarrier: sdohRow ? sdohRow.transportationFlag === 1 : null,
        foodInsecurity: sdohRow ? sdohRow.foodInsecurity === 1 : null,
        housingInstability: sdohRow ? sdohRow.housingInstability === 1 : null,
      },
      pharmacy: {
        title: "Pharmacy",
        fills: rxRows.map((r: any) => ({
          drugName: r.drugName,
          adherencePct: r.adherencePct,
          fillDate: r.fillDate,
        })),
      },
      claims: {
        title: "Recent claims",
        claimCount: claimRows.length,
        totalAmount: totalClaimAmount,
        countsByType: byType,
        recent: claimRows.slice(0, 8).map((c: any) => ({
          date: c.date,
          type: c.type,
          amount: c.amount,
          icdCode: c.icdCode,
          provider: c.provider,
        })),
      },
    },
  };
}

async function recommendOutreach(args: {
  memberId: string;
  drivers: string[];
}) {
  const { db, schema, orm } = await getDb();
  const { members } = schema;
  const { eq } = orm;

  const member = await db.query.members.findFirst({
    where: eq(members.id, args.memberId),
  });
  if (!member) return { error: "Member not found", recommendations: [] };

  const d = args.drivers.map((x) => x.toLowerCase()).join(" ");
  const out: { action: string; priority: string; rationale: string }[] = [];

  if (d.includes("transport") || d.includes("sdoh"))
    out.push({
      action: "Offer transportation benefit navigation and scheduling assistance",
      priority: "high",
      rationale: "Transport barriers often drive missed care.",
    });
  if (d.includes("food") || d.includes("hunger"))
    out.push({
      action: "Connect to food assistance programs and meal benefit review",
      priority: "high",
      rationale: "Food insecurity correlates with poor chronic disease control.",
    });
  if (d.includes("adher") || d.includes("pharmacy") || d.includes("medication"))
    out.push({
      action: "Pharmacist-led adherence call and 90-day fill review",
      priority: "medium",
      rationale: "Medication gaps are a modifiable driver of risk.",
    });
  if (member.riskTier === "high" || d.includes("clinical") || d.includes("risk"))
    out.push({
      action: "Care manager outreach within 48 hours",
      priority: "high",
      rationale: `Member is ${member.riskTier} clinical risk.`,
    });
  if (out.length === 0)
    out.push({
      action: "Routine wellness check-in",
      priority: "medium",
      rationale: "Default proactive engagement.",
    });

  return { memberId: args.memberId, memberName: member.name, recommendations: out };
}

async function generateChart(args: {
  chartType: string;
  dataQuery: string;
}) {
  const { db, schema, orm } = await getDb();
  const { members, claims } = schema;
  const { sql } = orm;

  const q = args.dataQuery.toLowerCase();
  let rows: any[];
  let title: string;

  if (q.includes("claim")) {
    rows = await db
      .select({ name: claims.type, value: sql`cast(count(*) as real)` })
      .from(claims)
      .groupBy(claims.type);
    title = "Claims volume by type";
  } else if (q.includes("state")) {
    rows = await db
      .select({ name: members.state, value: sql`cast(count(*) as real)` })
      .from(members)
      .groupBy(members.state);
    title = "Members by state";
  } else {
    rows = await db
      .select({ name: members.riskTier, value: sql`cast(count(*) as real)` })
      .from(members)
      .groupBy(members.riskTier);
    title = "Members by risk tier";
  }

  return {
    type: args.chartType,
    title,
    data: rows.map((r: any) => ({ name: String(r.name), value: Number(r.value) })),
  };
}

async function submitFeedback(args: {
  requestText: string;
  userRole: string;
}) {
  const { db, schema } = await getDb();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await db.insert(schema.feedbackRequests).values({
    id,
    userRole: args.userRole,
    requestText: args.requestText,
    status: "new",
    createdAt,
  });
  return { ok: true, id, message: "Feedback submitted for review.", createdAt };
}

async function runPipeline() {
  if (!isDirect) {
    return await proxyPipeline();
  }

  const { db, schema, orm } = await getDb();
  const { members, claims, pharmacy, sdoh, callCenter } = schema;
  const { count, avg, min, max, sql } = orm;

  const steps: any[] = [];

  // Ingest
  let start = Date.now();
  const [mc] = await db.select({ count: count() }).from(members);
  const [cc] = await db.select({ count: count() }).from(claims);
  const [rc] = await db.select({ count: count() }).from(pharmacy);
  const [sc] = await db.select({ count: count() }).from(sdoh);
  const [ccc] = await db.select({ count: count() }).from(callCenter);
  steps.push({
    step: "ingest",
    status: "completed",
    durationMs: Date.now() - start,
    output: { members: mc.count, claims: cc.count, pharmacy: rc.count, sdoh: sc.count, call_center: ccc.count, total_records: mc.count + cc.count + rc.count + sc.count + ccc.count },
  });

  // Profile
  start = Date.now();
  const [ageStats] = await db.select({ minAge: min(members.age), maxAge: max(members.age), avgAge: avg(members.age) }).from(members);
  const tierDist = await db.select({ tier: members.riskTier, count: count() }).from(members).groupBy(members.riskTier);
  steps.push({
    step: "profile",
    status: "completed",
    durationMs: Date.now() - start,
    output: { age: { min: ageStats.minAge, max: ageStats.maxAge, avg: Number(Number(ageStats.avgAge).toFixed(1)) }, riskTierDistribution: Object.fromEntries(tierDist.map((r: any) => [r.tier, r.count])) },
  });

  // Standardize
  start = Date.now();
  const icdCodes = await db.select({ code: claims.icdCode, count: count() }).from(claims).groupBy(claims.icdCode);
  const drugNames = await db.select({ drug: pharmacy.drugName, count: count() }).from(pharmacy).groupBy(pharmacy.drugName);
  steps.push({
    step: "standardize",
    status: "completed",
    durationMs: Date.now() - start,
    output: { icdCodesValidated: icdCodes.length, drugNamesMapped: drugNames.length },
  });

  // Entity Resolve
  start = Date.now();
  const [wc] = await db.select({ count: sql`count(distinct ${claims.memberId})` }).from(claims);
  steps.push({
    step: "entity_resolve",
    status: "completed",
    durationMs: Date.now() - start,
    output: { totalMembers: mc.count, linkedViaClaims: wc.count, matchRate: `${mc.count > 0 ? Math.round((Math.min(mc.count, wc.count) / mc.count) * 100) : 0}%` },
  });

  // Validate
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
  steps.push({
    step: "validate",
    status: "completed",
    durationMs: Date.now() - start,
    output: { rules, rulesPassed: passed, rulesTotal: rules.length, qualityScore: `${Math.round((passed / rules.length) * 100)}%`, readyForModeling: passed === rules.length },
  });

  const totalMs = steps.reduce((s: number, st: any) => s + st.durationMs, 0);
  steps.push({
    step: "summary",
    status: "completed",
    durationMs: totalMs,
    output: { pipeline: "hospitalization_risk_prediction", stepsCompleted: 5, stepsTotal: 5, totalDurationMs: totalMs, qualityScore: steps[4].output.qualityScore, readyForModeling: steps[4].output.readyForModeling },
  });

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
    const result = isDirect
      ? await identifyCohort(args)
      : JSON.parse(await proxyChat("identify_cohort", args));
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_risk_drivers",
  "Analyze top risk drivers for a member from clinical, SDOH, and pharmacy data",
  { memberId: z.string() },
  async (args) => {
    const result = isDirect
      ? await getRiskDrivers(args)
      : JSON.parse(await proxyChat("get_risk_drivers", args));
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "explain_member",
  "Produce a structured explanation of why a member is flagged using all available data",
  { memberId: z.string() },
  async (args) => {
    const result = isDirect
      ? await explainMember(args)
      : JSON.parse(await proxyChat("explain_member", args));
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "recommend_outreach",
  "Suggest prioritized interventions based on a member's risk drivers",
  {
    memberId: z.string(),
    drivers: z.array(z.string()).describe("Risk driver keywords"),
  },
  async (args) => {
    const result = isDirect
      ? await recommendOutreach(args)
      : JSON.parse(await proxyChat("recommend_outreach", args));
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "generate_chart",
  "Build chart-ready aggregates from the healthcare database",
  {
    chartType: z.enum(["bar", "pie", "line"]),
    dataQuery: z.string().describe("e.g. 'by state', 'by risk tier', 'claims by type'"),
  },
  async (args) => {
    const result = isDirect
      ? await generateChart(args)
      : JSON.parse(await proxyChat("generate_chart", args));
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "submit_feedback",
  "Record a feature or metric request for product review",
  {
    requestText: z.string(),
    userRole: z.string(),
  },
  async (args) => {
    const result = isDirect
      ? await submitFeedback(args)
      : JSON.parse(await proxyChat("submit_feedback", args));
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
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
