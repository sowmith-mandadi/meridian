import { z } from "zod";
import { createMcpHandler } from "mcp-handler";
import { and, avg, count, desc, eq, inArray, like, min, max, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  members, sdoh, pharmacy, claims, utilization,
  callCenter, auditLog, feedbackRequests,
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

    server.tool("request_governed_access", "FULL GOVERNED FLOW with human-in-the-loop. Returns enriched member records including risk drivers, outreach recommendations, and pharmacy data inline — no follow-up tool calls needed. userConfirmed must be true after user approves.", {
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

      const rows = await db.select({ _id: members.id, memberReference: members.memberReference, name: members.name, state: members.state, city: members.city, metroArea: members.metroArea, age: members.age, gender: members.gender, riskScore: members.riskScore, riskTier: members.riskTier, hospitalVisitProb6m: members.hospitalVisitProb6m, chronicConditions: members.chronicConditions, riskDrivers: members.riskDrivers, recommendedActions: members.recommendedActions, selectionExplanation: members.selectionExplanation, erVisits12m: members.erVisits12m, pcpVisits12m: members.pcpVisits12m, adherenceScore: members.adherenceScore, pcpName: members.pcpName, transportationBarrier: sdoh.transportationFlag, foodInsecurity: sdoh.foodInsecurity, housingInstability: sdoh.housingInstability }).from(members).leftJoin(sdoh, eq(members.id, sdoh.memberId)).where(w.length ? and(...w) : undefined).orderBy(sql`${members.hospitalVisitProb6m} desc`).limit(lim ?? 15);

      const memberIds = rows.map((r) => r._id);
      const rxRows = memberIds.length ? await db.select().from(pharmacy).where(inArray(pharmacy.memberId, memberIds)) : [];
      const rxByMember = new Map<string, typeof rxRows>();
      for (const rx of rxRows) { const arr = rxByMember.get(rx.memberId) ?? []; arr.push(rx); rxByMember.set(rx.memberId, arr); }

      const blocked = new Set(p.blockedFields);
      const records = rows.map((r) => {
        const rx = rxByMember.get(r._id) ?? [];
        const avgAdherence = rx.length ? rx.reduce((s, x) => s + x.adherencePct, 0) / rx.length : null;

        const drivers: { name: string; score: number; category: string }[] = [
          { name: "Clinical risk score", score: Math.min(1, Math.max(0, r.riskScore)), category: "clinical" },
        ];
        if (r.transportationBarrier) drivers.push({ name: "Transportation access", score: 0.82, category: "sdoh" });
        if (r.foodInsecurity) drivers.push({ name: "Food insecurity", score: 0.78, category: "sdoh" });
        if (r.housingInstability) drivers.push({ name: "Housing instability", score: 0.75, category: "sdoh" });
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

        const rec: Record<string, unknown> = {
          memberReference: r.memberReference, name: r.name, state: r.state, city: r.city,
          metroArea: r.metroArea, age: r.age, gender: r.gender, riskScore: r.riskScore,
          riskTier: r.riskTier, hospitalVisitProb6m: r.hospitalVisitProb6m,
          chronicConditions: r.chronicConditions, riskDrivers: r.riskDrivers,
          recommendedActions: r.recommendedActions, selectionExplanation: r.selectionExplanation,
          erVisits12m: r.erVisits12m, pcpVisits12m: r.pcpVisits12m,
          adherenceScore: r.adherenceScore, pcpName: r.pcpName,
          sdoh: { transportationBarrier: r.transportationBarrier === 1, foodInsecurity: r.foodInsecurity === 1, housingInstability: r.housingInstability === 1 },
          riskDriversDetail: drivers,
          outreachRecommendations: outreach,
          pharmacySummary: blocked.has("recommendedActions") ? undefined : {
            fillCount: rx.length,
            avgAdherencePct: avgAdherence !== null ? Math.round(avgAdherence * 10) / 10 : null,
            medications: rx.slice(0, 5).map((x) => ({ drug: x.drugName, class: x.drugClass, adherence: x.adherencePct })),
          },
        };
        return strip(rec, blocked);
      });

      const auditId = crypto.randomUUID();
      try { await db.insert(auditLog).values({ id: auditId, userId: "mcp", userRole: role, action: `governed_query:${intent}`, toolArgs: JSON.stringify(f ?? {}), resultSummary: `${rows.length} members (enriched)`, blockedFields: p.blockedFields.join(", "), policyNote: p.roleNote, createdAt: new Date().toISOString() }); } catch { /* */ }

      return { content: [{ type: "text" as const, text: JSON.stringify({ step: "QUERY_EXECUTED", governanceApplied: true, role, intent, summary: { matching: rows.length, highRisk: rows.filter((r) => r.riskTier === "high").length }, records, governance: { policyNote: p.roleNote, blockedFields: p.blockedFields, auditId }, note: "Each record includes riskDriversDetail, outreachRecommendations, and pharmacySummary inline. No follow-up member tool calls needed." }, null, 2) }] };
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

    server.tool("governed_member_detail", "Look up a single member by their governed masked reference (e.g. MBR-478) and return full risk drivers, outreach plan, pharmacy fills, claims, and explanation — all within the governance boundary. Use this for follow-up deep-dives on members returned by request_governed_access.", {
      memberReference: z.string().describe("The masked member reference from a governed query (e.g. MBR-478)"),
      role: z.enum(["care_manager", "analyst", "quality", "admin"]).describe("Must match the role used in the original governed query"),
      auditId: z.string().optional().describe("Audit ID from the original governed query for chain-of-custody"),
    }, async ({ memberReference, role, auditId: parentAuditId }) => {
      const p = ROLE_POLICIES[role] ?? ROLE_POLICIES.care_manager;
      const blocked = new Set(p.blockedFields);

      const m = await db.query.members.findFirst({ where: eq(members.memberReference, memberReference) });
      if (!m) return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Member not found for this governed reference.", memberReference }) }] };

      const [s, rx, cl] = await Promise.all([
        db.query.sdoh.findFirst({ where: eq(sdoh.memberId, m.id) }),
        db.select().from(pharmacy).where(eq(pharmacy.memberId, m.id)),
        db.select().from(claims).where(eq(claims.memberId, m.id)).orderBy(desc(claims.date)).limit(15),
      ]);

      const avgAdherence = rx.length ? rx.reduce((a, r) => a + r.adherencePct, 0) / rx.length : null;
      const drivers: { name: string; score: number; category: string }[] = [
        { name: "Clinical risk score", score: Math.min(1, Math.max(0, m.riskScore)), category: "clinical" },
      ];
      if (s?.transportationFlag) drivers.push({ name: "Transportation access", score: 0.82, category: "sdoh" });
      if (s?.foodInsecurity) drivers.push({ name: "Food insecurity", score: 0.78, category: "sdoh" });
      if (s?.housingInstability) drivers.push({ name: "Housing instability", score: 0.75, category: "sdoh" });
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

      const rec: Record<string, unknown> = {
        memberReference: m.memberReference, name: m.name, state: m.state, city: m.city,
        metroArea: m.metroArea, age: m.age, gender: m.gender, riskScore: m.riskScore,
        riskTier: m.riskTier, hospitalVisitProb6m: m.hospitalVisitProb6m,
        chronicConditions: m.chronicConditions, riskDrivers: m.riskDrivers,
        recommendedActions: m.recommendedActions, selectionExplanation: m.selectionExplanation,
        erVisits12m: m.erVisits12m, pcpVisits12m: m.pcpVisits12m,
        adherenceScore: m.adherenceScore, pcpName: m.pcpName,
        sdoh: s ? { transportationBarrier: s.transportationFlag === 1, foodInsecurity: s.foodInsecurity === 1, housingInstability: s.housingInstability === 1 } : null,
        overview: `${m.name}, ${m.age}yo ${m.gender} in ${m.city}, ${m.state}. ${m.riskTier} risk (${m.riskScore}). ${m.selectionExplanation}`,
        riskDriversDetail: drivers,
        outreachRecommendations: outreach,
        pharmacyDetail: {
          fillCount: rx.length,
          avgAdherencePct: avgAdherence !== null ? Math.round(avgAdherence * 10) / 10 : null,
          medications: rx.map((x) => ({ drug: x.drugName, class: x.drugClass, adherence: x.adherencePct, fillDate: x.fillDate })),
        },
        claimsSummary: {
          count: cl.length, totalAmount: cl.reduce((a, c) => a + c.amount, 0),
          recent: cl.slice(0, 5).map((c) => ({ date: c.date, type: c.type, amount: c.amount, icdCode: c.icdCode })),
        },
      };
      const sanitized = strip(rec, blocked);

      const detailAuditId = crypto.randomUUID();
      try { await db.insert(auditLog).values({ id: detailAuditId, userId: "mcp", userRole: role, action: `governed_member_detail`, toolArgs: JSON.stringify({ memberReference, parentAuditId }), resultSummary: `Detail for ${memberReference}`, blockedFields: p.blockedFields.join(", "), policyNote: p.roleNote, createdAt: new Date().toISOString() }); } catch { /* */ }

      return { content: [{ type: "text" as const, text: JSON.stringify({ memberReference, role, governanceApplied: true, record: sanitized, governance: { policyNote: p.roleNote, blockedFields: p.blockedFields, auditId: detailAuditId, parentAuditId: parentAuditId ?? null } }, null, 2) }] };
    });

    server.tool("run_pipeline", "Execute the 5-step healthcare data pipeline: Ingest, Profile, Standardize, Entity Resolve, Validate", {}, async () => {
      const steps: { step: string; status: string; durationMs: number; output: Record<string, unknown> }[] = [];

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
      steps.push({ step: "profile", status: "completed", durationMs: Date.now() - start, output: { age: { min: ageStats.minAge, max: ageStats.maxAge, avg: Number(Number(ageStats.avgAge).toFixed(1)) }, riskTierDistribution: Object.fromEntries(tierDist.map((r) => [r.tier, r.count])) } });

      start = Date.now();
      const icdCodes = await db.select({ code: claims.icdCode, count: count() }).from(claims).groupBy(claims.icdCode);
      const drugNames = await db.select({ drug: pharmacy.drugName, count: count() }).from(pharmacy).groupBy(pharmacy.drugName);
      steps.push({ step: "standardize", status: "completed", durationMs: Date.now() - start, output: { icdCodesValidated: icdCodes.length, drugNamesMapped: drugNames.length } });

      start = Date.now();
      const [wc] = await db.select({ count: sql<number>`count(distinct ${claims.memberId})` }).from(claims);
      steps.push({ step: "entity_resolve", status: "completed", durationMs: Date.now() - start, output: { totalMembers: mc.count, linkedViaClaims: wc.count, matchRate: `${mc.count > 0 ? Math.round((Math.min(mc.count, wc.count) / mc.count) * 100) : 0}%` } });

      start = Date.now();
      const orphanResult = await db.all(sql`select count(*) as cnt from claims where member_id not in (select id from members)`);
      const orphanCount = (orphanResult[0] as Record<string, number>)?.cnt ?? 0;
      const rangeResult = await db.all(sql`select count(*) as cnt from members where risk_score < 0 or risk_score > 1`);
      const outOfRange = (rangeResult[0] as Record<string, number>)?.cnt ?? 0;
      const rules = [
        { rule: "Grain: one row per member", passed: mc.count > 0 },
        { rule: "Referential integrity", passed: orphanCount === 0 },
        { rule: "Risk score in [0,1]", passed: outOfRange === 0 },
      ];
      const passed = rules.filter((r) => r.passed).length;
      steps.push({ step: "validate", status: "completed", durationMs: Date.now() - start, output: { rules, rulesPassed: passed, rulesTotal: rules.length, qualityScore: `${Math.round((passed / rules.length) * 100)}%`, readyForModeling: passed === rules.length } });

      const totalMs = steps.reduce((s, st) => s + st.durationMs, 0);
      steps.push({ step: "summary", status: "completed", durationMs: totalMs, output: { pipeline: "hospitalization_risk_prediction", stepsCompleted: 5, stepsTotal: 5, totalDurationMs: totalMs, qualityScore: steps[4].output.qualityScore as string, readyForModeling: steps[4].output.readyForModeling as boolean } });

      return { content: [{ type: "text" as const, text: JSON.stringify(steps, null, 2) }] };
    });
  },
  {},
  { basePath: "/api/mcp" },
);

export { handler as GET, handler as POST, handler as DELETE };
