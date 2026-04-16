import { z } from "zod";
import { createMcpHandler } from "mcp-handler";
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  members, sdoh, pharmacy, claims, utilization,
  auditLog, feedbackRequests,
} from "@/lib/schema";

const ROLE_POLICIES: Record<string, { allowedIntents: string[]; blockedFields: string[]; roleNote: string }> = {
  care_manager: { allowedIntents: ["cohort", "member_outreach", "pharmacy_review", "quality_gap", "provider_coordination"], blockedFields: [], roleNote: "Full access with masked identifiers." },
  analyst: { allowedIntents: ["cohort", "pharmacy_review"], blockedFields: ["transportationBarrier", "foodInsecurity", "housingInstability", "financialStress", "socialIsolation", "recommendedActions", "selectionExplanation"], roleNote: "SDOH and outreach BLOCKED." },
  quality: { allowedIntents: ["aggregate", "quality_gap", "cohort"], blockedFields: ["transportationBarrier", "foodInsecurity", "housingInstability", "financialStress", "socialIsolation", "recommendedActions", "selectionExplanation", "pcpName"], roleNote: "Aggregate only. SDOH, outreach, provider BLOCKED." },
  admin: { allowedIntents: ["cohort", "member_outreach", "pharmacy_review", "quality_gap", "provider_coordination", "aggregate"], blockedFields: [], roleNote: "Full admin access." },
};

function strip(obj: Record<string, unknown>, blocked: Set<string>) {
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) { if (!blocked.has(k)) r[k] = v; }
  return r;
}

const handler = createMcpHandler(
  (server) => {
    server.tool("check_governance", "GOVERNANCE GATE — Preview rules for a role/intent. Agent MUST show user and ask confirmation.", { role: z.enum(["care_manager", "analyst", "quality", "admin"]), intent: z.string() }, async ({ role, intent }) => {
      const p = ROLE_POLICIES[role] ?? ROLE_POLICIES.care_manager;
      const ok = p.allowedIntents.includes(intent);
      return { content: [{ type: "text" as const, text: JSON.stringify({ governancePreview: true, role, intent, intentAllowed: ok, decision: ok ? "ALLOWED" : "BLOCKED", policyNote: p.roleNote, blockedFields: p.blockedFields.length ? p.blockedFields : ["(none)"], fieldMaskingSummary: p.blockedFields.length ? `${p.blockedFields.length} fields redacted` : "Full visibility", confirmationPrompt: ok ? `Governance passed for "${role}"/"${intent}". ${p.blockedFields.length ? `${p.blockedFields.length} fields masked.` : "Full access."} Proceed?` : `BLOCKED: "${role}" cannot "${intent}". Allowed: ${p.allowedIntents.join(", ")}.` }, null, 2) }] };
    });

    server.tool("request_governed_access", "FULL GOVERNED FLOW with human-in-the-loop. userConfirmed must be true after user approves.", {
      role: z.enum(["care_manager", "analyst", "quality", "admin"]), intent: z.string(),
      filters: z.object({ states: z.array(z.string()).optional(), riskTier: z.string().optional(), conditions: z.array(z.string()).optional(), diabetesOnly: z.boolean().optional(), minErVisits: z.number().optional(), maxPcpVisits: z.number().optional(), metroAreaContains: z.string().optional(), adherenceBelow: z.number().optional() }).optional(),
      scope: z.enum(["aggregated", "member_level"]).optional(), limit: z.number().optional(), userConfirmed: z.boolean(),
    }, async ({ role, intent, filters: f, scope, limit: lim, userConfirmed }) => {
      const p = ROLE_POLICIES[role] ?? ROLE_POLICIES.care_manager;
      if (!p.allowedIntents.includes(intent)) return { content: [{ type: "text" as const, text: JSON.stringify({ step: "GOVERNANCE_BLOCK", role, intent, allowedIntents: p.allowedIntents }, null, 2) }] };
      if (!userConfirmed) return { content: [{ type: "text" as const, text: JSON.stringify({ step: "AWAITING_USER_CONFIRMATION", role, intent, policyNote: p.roleNote, blockedFields: p.blockedFields, scope: scope ?? "member_level", filters: f ?? {}, confirmationPrompt: `Query as "${role}". ${p.blockedFields.length ? `${p.blockedFields.length} fields masked.` : "Full access."} Approve?` }, null, 2) }] };

      const w = [];
      if (f?.riskTier) w.push(eq(members.riskTier, f.riskTier));
      if (f?.states?.length) w.push(inArray(members.state, f.states));
      if (f?.diabetesOnly) w.push(eq(members.diabetesFlag, 1));
      if (f?.conditions?.length) { const c = or(...f.conditions.map((x) => like(members.chronicConditions, `%${x}%`))); if (c) w.push(c); }
      if (f?.minErVisits != null) w.push(sql`${members.erVisits12m} >= ${f.minErVisits}`);
      if (f?.maxPcpVisits != null) w.push(sql`${members.pcpVisits12m} <= ${f.maxPcpVisits}`);
      if (f?.metroAreaContains) w.push(like(members.metroArea, `%${f.metroAreaContains}%`));

      const rows = await db.select({ memberReference: members.memberReference, name: members.name, state: members.state, city: members.city, metroArea: members.metroArea, age: members.age, riskScore: members.riskScore, riskTier: members.riskTier, hospitalVisitProb6m: members.hospitalVisitProb6m, chronicConditions: members.chronicConditions, riskDrivers: members.riskDrivers, recommendedActions: members.recommendedActions, selectionExplanation: members.selectionExplanation, erVisits12m: members.erVisits12m, pcpVisits12m: members.pcpVisits12m, adherenceScore: members.adherenceScore, pcpName: members.pcpName, transportationBarrier: sdoh.transportationFlag, foodInsecurity: sdoh.foodInsecurity, housingInstability: sdoh.housingInstability }).from(members).leftJoin(sdoh, eq(members.id, sdoh.memberId)).where(w.length ? and(...w) : undefined).orderBy(sql`${members.hospitalVisitProb6m} desc`).limit(lim ?? 15);

      const blocked = new Set(p.blockedFields);
      const records = rows.map((r) => strip(r as unknown as Record<string, unknown>, blocked));
      const auditId = crypto.randomUUID();
      try { await db.insert(auditLog).values({ id: auditId, userId: "mcp", userRole: role, action: `governed_query:${intent}`, toolArgs: JSON.stringify(f ?? {}), resultSummary: `${rows.length} members`, blockedFields: p.blockedFields.join(", "), policyNote: p.roleNote, createdAt: new Date().toISOString() }); } catch { /* */ }

      return { content: [{ type: "text" as const, text: JSON.stringify({ step: "QUERY_EXECUTED", governanceApplied: true, role, intent, summary: { matching: rows.length, highRisk: rows.filter((r) => r.riskTier === "high").length }, records, governance: { policyNote: p.roleNote, blockedFields: p.blockedFields, auditId } }, null, 2) }] };
    });

    server.tool("identify_cohort", "Find members by state/condition/risk with SDOH", { states: z.array(z.string()), conditions: z.array(z.string()), riskTier: z.enum(["high", "medium", "low"]) }, async ({ states, conditions: conds, riskTier }) => {
      const f = [eq(members.riskTier, riskTier)];
      if (states.length) f.push(inArray(members.state, states));
      if (conds.length) { const c = or(...conds.map((x) => like(members.chronicConditions, `%${x}%`))); if (c) f.push(c); }
      const rows = await db.select({ id: members.id, ref: members.memberReference, name: members.name, state: members.state, city: members.city, age: members.age, riskScore: members.riskScore, riskTier: members.riskTier, prob: members.hospitalVisitProb6m, conditions: members.chronicConditions, drivers: members.riskDrivers, er: members.erVisits12m, pcp: members.pcpVisits12m, adherence: members.adherenceScore, sT: sdoh.transportationFlag, sF: sdoh.foodInsecurity, sH: sdoh.housingInstability }).from(members).leftJoin(sdoh, eq(members.id, sdoh.memberId)).where(and(...f));
      return { content: [{ type: "text" as const, text: JSON.stringify({ count: rows.length, members: rows.map((m) => ({ ...m, sdoh: { transport: m.sT === 1, food: m.sF === 1, housing: m.sH === 1 } })) }, null, 2) }] };
    });

    server.tool("get_risk_drivers", "Risk drivers for a member", { memberId: z.string() }, async ({ memberId }) => {
      const m = await db.query.members.findFirst({ where: eq(members.id, memberId) });
      if (!m) return { content: [{ type: "text" as const, text: '{"error":"Not found"}' }] };
      const s = await db.query.sdoh.findFirst({ where: eq(sdoh.memberId, memberId) });
      const rx = await db.select().from(pharmacy).where(eq(pharmacy.memberId, memberId));
      const avg = rx.length ? rx.reduce((a, r) => a + r.adherencePct, 0) / rx.length : null;
      const d: { name: string; score: number; cat: string }[] = [{ name: "Clinical risk", score: m.riskScore, cat: "clinical" }];
      if (s?.transportationFlag) d.push({ name: "Transportation", score: 0.82, cat: "sdoh" });
      if (s?.foodInsecurity) d.push({ name: "Food insecurity", score: 0.78, cat: "sdoh" });
      if (s?.housingInstability) d.push({ name: "Housing instability", score: 0.75, cat: "sdoh" });
      if (avg !== null) d.push({ name: "Medication adherence", score: Math.min(1, 1 - avg / 100), cat: "pharmacy" });
      if (m.erVisits12m >= 3) d.push({ name: "Frequent ER", score: 0.85, cat: "utilization" });
      d.sort((a, b) => b.score - a.score);
      return { content: [{ type: "text" as const, text: JSON.stringify({ member: { id: m.id, ref: m.memberReference, name: m.name, riskScore: m.riskScore, riskTier: m.riskTier, drivers: m.riskDrivers, explanation: m.selectionExplanation }, drivers: d }, null, 2) }] };
    });

    server.tool("explain_member", "Full member explanation", { memberId: z.string() }, async ({ memberId }) => {
      const m = await db.query.members.findFirst({ where: eq(members.id, memberId) });
      if (!m) return { content: [{ type: "text" as const, text: '{"error":"Not found"}' }] };
      const [s, rx, cl] = await Promise.all([db.query.sdoh.findFirst({ where: eq(sdoh.memberId, memberId) }), db.select().from(pharmacy).where(eq(pharmacy.memberId, memberId)), db.select().from(claims).where(eq(claims.memberId, memberId)).orderBy(desc(claims.date)).limit(15)]);
      return { content: [{ type: "text" as const, text: JSON.stringify({ overview: `${m.name}, ${m.age}yo ${m.gender} in ${m.city}, ${m.state}. ${m.riskTier} risk (${m.riskScore}). ${m.selectionExplanation}`, demographics: { id: m.id, ref: m.memberReference, state: m.state, city: m.city, age: m.age, pcp: m.pcpName }, clinical: { conditions: m.chronicConditions, riskScore: m.riskScore, tier: m.riskTier, prob6m: m.hospitalVisitProb6m, drivers: m.riskDrivers, actions: m.recommendedActions }, sdoh: s ? { transport: s.transportationFlag === 1, food: s.foodInsecurity === 1, housing: s.housingInstability === 1 } : null, pharmacy: rx.map((r) => ({ drug: r.drugName, cls: r.drugClass, adherence: r.adherencePct })), claims: { count: cl.length, total: cl.reduce((a, c) => a + c.amount, 0), recent: cl.slice(0, 5).map((c) => ({ date: c.date, type: c.type, amount: c.amount })) } }, null, 2) }] };
    });

    server.tool("recommend_outreach", "Outreach recommendations", { memberId: z.string(), drivers: z.array(z.string()) }, async ({ memberId, drivers: drvs }) => {
      const m = await db.query.members.findFirst({ where: eq(members.id, memberId) });
      if (!m) return { content: [{ type: "text" as const, text: '{"error":"Not found"}' }] };
      const d = drvs.map((x) => x.toLowerCase()).join(" ");
      const out: { action: string; priority: string; rationale: string }[] = [];
      if (d.includes("transport")) out.push({ action: "Transportation benefit navigation", priority: "high", rationale: "Transport barriers drive missed care." });
      if (d.includes("food")) out.push({ action: "Food assistance programs", priority: "high", rationale: "Food insecurity worsens disease." });
      if (d.includes("adher") || d.includes("medication")) out.push({ action: "Pharmacist adherence call", priority: "medium", rationale: "Medication gaps are modifiable." });
      if (m.riskTier === "high" || d.includes("risk")) out.push({ action: "Care manager outreach 48h", priority: "high", rationale: `${m.riskTier} risk.` });
      if (!out.length) out.push({ action: "Routine wellness check-in", priority: "medium", rationale: "Default engagement." });
      return { content: [{ type: "text" as const, text: JSON.stringify({ memberId, ref: m.memberReference, name: m.name, recommendations: out }, null, 2) }] };
    });

    server.tool("generate_chart", "Chart aggregates", { chartType: z.enum(["bar", "pie", "line"]), dataQuery: z.string() }, async ({ chartType, dataQuery }) => {
      const q = dataQuery.toLowerCase();
      let rows: { name: string | null; value: number }[]; let title: string;
      if (q.includes("claim")) { rows = await db.select({ name: claims.type, value: sql<number>`cast(count(*) as real)` }).from(claims).groupBy(claims.type); title = "Claims by type"; }
      else if (q.includes("state")) { rows = await db.select({ name: members.state, value: sql<number>`cast(count(*) as real)` }).from(members).groupBy(members.state); title = "Members by state"; }
      else if (q.includes("util") || q.includes("er")) { rows = await db.select({ name: utilization.eventType, value: sql<number>`cast(count(*) as real)` }).from(utilization).groupBy(utilization.eventType); title = "Utilization by type"; }
      else { rows = await db.select({ name: members.riskTier, value: sql<number>`cast(count(*) as real)` }).from(members).groupBy(members.riskTier); title = "Members by risk tier"; }
      return { content: [{ type: "text" as const, text: JSON.stringify({ type: chartType, title, data: rows.map((r) => ({ name: String(r.name), value: Number(r.value) })) }, null, 2) }] };
    });

    server.tool("submit_feedback", "Record feedback", { requestText: z.string(), userRole: z.string() }, async ({ requestText, userRole }) => {
      const id = crypto.randomUUID();
      await db.insert(feedbackRequests).values({ id, userRole, requestText, status: "new", createdAt: new Date().toISOString() });
      return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true, id }) }] };
    });
  },
  {},
  { basePath: "/api/mcp" },
);

export { handler as GET, handler as POST, handler as DELETE };
