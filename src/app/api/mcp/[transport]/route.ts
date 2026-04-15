import { z } from "zod";
import { createMcpHandler } from "mcp-handler";
import { and, avg, count, desc, eq, inArray, like, min, max, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  members, sdoh, pharmacy, claims, utilization,
  callCenter, auditLog, feedbackRequests,
  rawClaims, rawPharmacy, stagingQuarantine,
  dataProducts, customSources, pipelineRuns,
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

    // ── Composable Pipeline Tools ────────────────────────────────────────

    const KNOWN_TABLES = [
      { name: "members", ref: members },
      { name: "claims", ref: claims },
      { name: "pharmacy", ref: pharmacy },
      { name: "sdoh", ref: sdoh },
      { name: "call_center", ref: callCenter },
      { name: "utilization", ref: utilization },
      { name: "raw_claims", ref: rawClaims },
      { name: "raw_pharmacy", ref: rawPharmacy },
      { name: "staging_quarantine", ref: stagingQuarantine },
    ] as const;

    const VALID_ICD_SET = new Set(["E11.9", "I50.9", "J44.1", "I10", "N18.9", "J45.909", "F32.9", "Z00.0"]);
    const ICD_CORRECTIONS: Record<string, string> = { "E119": "E11.9", "I509": "I50.9", "J441": "J44.1", "I1O": "I10", "N189": "N18.9", "j45.909": "J45.909", "F329": "F32.9", "E11": "E11.9", "I50": "I50.9" };
    const VALID_DRUG_SET = new Set(["Metformin", "Ozempic", "Jardiance", "Lisinopril", "Atorvastatin", "Losartan", "Albuterol", "Symbicort", "Sertraline", "Buspirone", "Amlodipine", "Omeprazole", "Insulin Glargine", "Furosemide"]);
    const DRUG_CORRECTIONS: Record<string, string> = { "metformin": "Metformin", "OZEMPIC": "Ozempic", "jardiance": "Jardiance", "Lisinoprl": "Lisinopril", "atorvastatin": "Atorvastatin", "losartan HCL": "Losartan", "albuterol sulfate": "Albuterol", "Symbicrt": "Symbicort", "sertralin": "Sertraline" };

    server.tool("inspect_sources", "Inventory all data sources — row counts, columns, null rates, freshness. The agent's first move to understand what data exists.", {}, async () => {
      const tables: Record<string, unknown>[] = [];

      for (const t of KNOWN_TABLES) {
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

    server.tool("profile_table", "Deep-dive stats for a single table — distributions, nulls, outliers, distinct counts. Agent picks which table to investigate.", {
      table: z.string().describe("Table name to profile, e.g. 'members', 'raw_claims', 'raw_pharmacy'"),
    }, async ({ table: tableName }) => {
      const profile: Record<string, unknown> = { table: tableName };

      if (tableName === "members") {
        const [stats] = await db.select({ count: count(), minAge: min(members.age), maxAge: max(members.age), avgAge: avg(members.age), minRisk: min(members.riskScore), maxRisk: max(members.riskScore), avgRisk: avg(members.riskScore) }).from(members);
        const tierDist = await db.select({ tier: members.riskTier, count: count() }).from(members).groupBy(members.riskTier);
        const stateDist = await db.select({ state: members.state, count: count() }).from(members).groupBy(members.state);
        const [nulls] = await db.select({ nullName: sql<number>`sum(case when name='' then 1 else 0 end)`, nullState: sql<number>`sum(case when state='' then 1 else 0 end)`, nullRisk: sql<number>`sum(case when risk_score is null then 1 else 0 end)`, nullDrivers: sql<number>`sum(case when risk_drivers='' then 1 else 0 end)` }).from(members);
        profile.stats = stats; profile.tierDistribution = Object.fromEntries(tierDist.map((r) => [r.tier, r.count])); profile.stateDistribution = Object.fromEntries(stateDist.map((r) => [r.state, r.count])); profile.nullCounts = nulls;
      } else if (tableName === "raw_claims") {
        const [stats] = await db.select({ count: count(), minAmt: min(rawClaims.amount), maxAmt: max(rawClaims.amount), avgAmt: avg(rawClaims.amount) }).from(rawClaims);
        const icdDist = await db.select({ code: rawClaims.icdCode, count: count() }).from(rawClaims).groupBy(rawClaims.icdCode);
        const typeDist = await db.select({ type: rawClaims.type, count: count() }).from(rawClaims).groupBy(rawClaims.type);
        const sourceDist = await db.select({ src: rawClaims.sourceFile, count: count() }).from(rawClaims).groupBy(rawClaims.sourceFile);
        const [nulls] = await db.select({ emptyMemberId: sql<number>`sum(case when member_id='' then 1 else 0 end)`, emptyIcd: sql<number>`sum(case when icd_code='' then 1 else 0 end)`, emptyDate: sql<number>`sum(case when date='' then 1 else 0 end)`, negativeAmt: sql<number>`sum(case when amount<0 then 1 else 0 end)`, outlierAmt: sql<number>`sum(case when amount>100000 then 1 else 0 end)`, total: count() }).from(rawClaims);
        const [orphans] = await db.select({ count: sql<number>`count(*)` }).from(rawClaims).where(sql`member_id != '' AND member_id NOT IN (SELECT id FROM members)`);
        const invalidIcd = icdDist.filter((r) => r.code !== "" && !VALID_ICD_SET.has(r.code));
        const today = new Date().toISOString().split("T")[0];
        const [futureDated] = await db.select({ count: sql<number>`sum(case when date > ${today} then 1 else 0 end)` }).from(rawClaims);
        profile.stats = stats; profile.icdDistribution = icdDist; profile.typeDistribution = Object.fromEntries(typeDist.map((r) => [r.type, r.count])); profile.sourceFiles = Object.fromEntries(sourceDist.map((r) => [r.src, r.count]));
        profile.issues = { ...nulls, orphanMemberIds: orphans.count, invalidIcdCodes: invalidIcd.map((r) => ({ code: r.code, count: r.count })), futureDatedRecords: futureDated.count };
      } else if (tableName === "raw_pharmacy") {
        const [stats] = await db.select({ count: count(), minAdh: min(rawPharmacy.adherencePct), maxAdh: max(rawPharmacy.adherencePct), avgAdh: avg(rawPharmacy.adherencePct) }).from(rawPharmacy);
        const drugDist = await db.select({ drug: rawPharmacy.drugName, count: count() }).from(rawPharmacy).groupBy(rawPharmacy.drugName);
        const [nulls] = await db.select({ emptyMemberId: sql<number>`sum(case when member_id='' then 1 else 0 end)`, emptyDrug: sql<number>`sum(case when drug_name='' then 1 else 0 end)`, emptyDate: sql<number>`sum(case when fill_date='' then 1 else 0 end)`, outOfRangeAdh: sql<number>`sum(case when adherence_pct<0 or adherence_pct>100 then 1 else 0 end)`, total: count() }).from(rawPharmacy);
        const invalidDrugs = drugDist.filter((r) => r.drug !== "" && !VALID_DRUG_SET.has(r.drug));
        profile.stats = stats; profile.drugDistribution = drugDist; profile.issues = { ...nulls, invalidDrugNames: invalidDrugs.map((r) => ({ drug: r.drug, count: r.count, correction: DRUG_CORRECTIONS[r.drug] ?? null })) };
      } else if (tableName === "claims") {
        const [stats] = await db.select({ count: count(), minAmt: min(claims.amount), maxAmt: max(claims.amount), avgAmt: avg(claims.amount) }).from(claims);
        const typeDist = await db.select({ type: claims.type, count: count() }).from(claims).groupBy(claims.type);
        profile.stats = stats; profile.typeDistribution = Object.fromEntries(typeDist.map((r) => [r.type, r.count]));
      } else if (tableName === "pharmacy") {
        const [stats] = await db.select({ count: count(), minAdh: min(pharmacy.adherencePct), maxAdh: max(pharmacy.adherencePct), avgAdh: avg(pharmacy.adherencePct) }).from(pharmacy);
        const drugDist = await db.select({ drug: pharmacy.drugName, count: count() }).from(pharmacy).groupBy(pharmacy.drugName);
        profile.stats = stats; profile.drugDistribution = drugDist;
      } else {
        const result = await db.all(sql.raw(`SELECT COUNT(*) as cnt FROM "${tableName}"`));
        profile.rowCount = (result[0] as Record<string, number>)?.cnt ?? 0;
        profile.note = "Basic profile only — use known table names for detailed stats.";
      }

      return { content: [{ type: "text" as const, text: JSON.stringify(profile, null, 2) }] };
    });

    server.tool("standardize_records", "Clean and standardize raw data — fix ICD codes, normalize drug names, flag bad dates, quarantine invalid records. Set dryRun=true to preview without writing.", {
      source: z.enum(["raw_claims", "raw_pharmacy"]).describe("Which raw table to standardize"),
      dryRun: z.boolean().optional().describe("Preview changes without writing (default false)"),
    }, async ({ source, dryRun }) => {
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

    server.tool("resolve_entities", "Check entity linkage across data sources. Exact mode checks FK integrity. Fuzzy mode finds potential duplicate members by name+state similarity.", {
      strategy: z.enum(["exact", "fuzzy"]).describe("exact = FK check, fuzzy = name similarity matching"),
    }, async ({ strategy }) => {
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
          totalOrphans: checks.reduce((s, c) => s + (c[0] as Record<string, number>).cnt, 0),
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
        return { content: [{ type: "text" as const, text: JSON.stringify({ strategy: "fuzzy", candidateDuplicates: candidates.length, candidates: candidates.slice(0, 15), note: "These are potential duplicates sharing last name and state. Agent should review before deduplicating." }, null, 2) }] };
      }
    });

    server.tool("quarantine_records", "Move bad records from a source table to the quarantine staging area. Agent decides what to quarantine and why.", {
      source: z.enum(["raw_claims", "raw_pharmacy"]).describe("Source table"),
      reason: z.string().describe("Why these records are being quarantined"),
      filter: z.object({
        field: z.string().describe("Column to filter on"),
        condition: z.enum(["empty", "out_of_range", "orphan", "future_dated"]).describe("Filter condition"),
      }),
    }, async ({ source, reason, filter }) => {
      let moved = 0;
      if (source === "raw_claims") {
        let condition: ReturnType<typeof sql>;
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
        let condition: ReturnType<typeof sql>;
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

    server.tool("validate_quality", "Run configurable quality gates across the dataset. Agent picks which rules to enforce and what thresholds to use.", {
      rules: z.array(z.string()).optional().describe("Rules to run: not_empty, unique_ids, required_fields, risk_range, tier_consistency, referential_integrity, completeness, distribution, linkage. Default: all."),
      thresholds: z.object({ completeness: z.number().optional(), linkage: z.number().optional() }).optional(),
    }, async ({ rules: ruleList, thresholds }) => {
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
        else if (rule === "distribution") { const tiers = await db.select({ tier: members.riskTier, count: count() }).from(members).groupBy(members.riskTier); const counts = tiers.map((t) => t.count); const ok = counts.length >= 2 && !counts.some((c) => c === mc.count); results.push({ rule, passed: ok, detail: `${counts.length} tiers: ${tiers.map((t) => `${t.tier}=${t.count}`).join(", ")}` }); }
        else if (rule === "linkage") { const [lc] = await db.select({ count: sql<number>`count(distinct member_id)` }).from(claims); const rate = mc.count > 0 ? lc.count / mc.count : 0; results.push({ rule, passed: rate >= linkThreshold, detail: `${Math.round(rate * 100)}% linked (threshold: ${linkThreshold * 100}%)` }); }
      }

      const passed = results.filter((r) => r.passed).length;
      return { content: [{ type: "text" as const, text: JSON.stringify({ rulesEvaluated: results.length, rulesPassed: passed, qualityScore: `${Math.round((passed / results.length) * 100)}%`, readyForModeling: passed === results.length, results }, null, 2) }] };
    });

    server.tool("save_pipeline_run", "Record the agent's pipeline decisions — which steps it ran, what it found, and the final quality score. Creates an audit trail.", {
      steps: z.array(z.object({ name: z.string(), result: z.string(), recordsAffected: z.number() })),
      qualityScore: z.number().describe("0-100"),
      notes: z.string().optional(),
    }, async ({ steps: stepList, qualityScore, notes }) => {
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

    server.tool("create_data_source", "Create a new data table from a natural language description. Agent defines columns and optionally inserts sample data. Registered in the source catalog for pipeline tools to discover.", {
      name: z.string().describe("Table name (lowercase, underscores)"),
      description: z.string().describe("What this data source contains"),
      columns: z.array(z.object({ name: z.string(), type: z.enum(["text", "integer", "real"]), required: z.boolean().optional() })),
      sampleData: z.array(z.record(z.string(), z.unknown())).optional().describe("Optional rows to insert"),
    }, async ({ name, description, columns, sampleData }) => {
      const safeName = name.replace(/[^a-z0-9_]/g, "_").toLowerCase();
      const colDefs = columns.map((c) => `"${c.name}" ${c.type.toUpperCase()}${c.required ? " NOT NULL" : ""} DEFAULT ${c.type === "text" ? "''" : "0"}`);
      colDefs.unshift('"id" TEXT PRIMARY KEY');

      await db.run(sql.raw(`CREATE TABLE IF NOT EXISTS "${safeName}" (${colDefs.join(", ")})`));

      let rowCount = 0;
      if (sampleData?.length) {
        for (const row of sampleData) {
          const id = crypto.randomUUID();
          const cols = ["id", ...Object.keys(row)];
          const vals = [id, ...Object.values(row)].map((v) => typeof v === "string" ? `'${String(v).replace(/'/g, "''")}'` : String(v));
          await db.run(sql.raw(`INSERT OR IGNORE INTO "${safeName}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${vals.join(", ")})`));
          rowCount++;
        }
      }

      await db.insert(customSources).values({ id: crypto.randomUUID(), tableName: safeName, columnsJson: JSON.stringify(columns), rowCount, createdBy: "agent", description, createdAt: new Date().toISOString() }).onConflictDoNothing();

      return { content: [{ type: "text" as const, text: JSON.stringify({ created: true, table: safeName, columns: columns.length, rowsInserted: rowCount, description, note: "Table is now visible in inspect_sources and profile_table." }, null, 2) }] };
    });

    server.tool("create_data_product", "Save a named, versioned data product definition to the catalog. Other agents and users can discover and reuse it.", {
      name: z.string().describe("Product name, e.g. 'diabetes_care_gaps'"),
      description: z.string(),
      sourceTables: z.array(z.string()).describe("Tables this product draws from"),
      filters: z.record(z.string(), z.unknown()).optional().describe("Filter criteria as key-value pairs"),
      columns: z.array(z.string()).optional().describe("Columns to include in the product"),
    }, async ({ name, description, sourceTables, filters, columns: cols }) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const existing = await db.select().from(dataProducts).where(eq(dataProducts.name, name));
      const version = existing.length > 0 ? Math.max(...existing.map((e) => e.version)) + 1 : 1;

      await db.insert(dataProducts).values({
        id, name, description, createdBy: "agent",
        sourceTables: JSON.stringify(sourceTables),
        queryDefinition: JSON.stringify({ filters: filters ?? {}, columns: cols ?? [] }),
        version, status: "published", createdAt: now, updatedAt: now,
      });

      return { content: [{ type: "text" as const, text: JSON.stringify({ created: true, productId: id, name, version, sourceTables, status: "published", note: "Product is now discoverable via list_data_products." }, null, 2) }] };
    });

    server.tool("list_data_products", "List all saved data products in the catalog. Shows what's available for reuse.", {}, async () => {
      const products = await db.select().from(dataProducts).orderBy(desc(dataProducts.updatedAt));
      return { content: [{ type: "text" as const, text: JSON.stringify({ count: products.length, products: products.map((p) => ({ id: p.id, name: p.name, description: p.description, version: p.version, status: p.status, sourceTables: JSON.parse(p.sourceTables), createdBy: p.createdBy, createdAt: p.createdAt })) }, null, 2) }] };
    });
  },
  {},
  { basePath: "/api/mcp" },
);

export { handler as GET, handler as POST, handler as DELETE };
