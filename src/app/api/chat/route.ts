import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
} from "ai";
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  claims,
  feedbackRequests,
  members,
  pharmacy,
  sdoh,
  usageLog,
  utilization,
} from "@/lib/schema";
import { auth } from "@/lib/auth";
import {
  type GovernanceRole,
  ROLE_POLICIES,
  filterToolsByRole,
  sanitizeRecord,
  writeAuditLog,
  getBlockedFields,
  getRoleNote,
} from "@/lib/governance";

function buildSystemPrompt(role: GovernanceRole): string {
  const policy = ROLE_POLICIES[role];
  return `You are Meridian, a governed healthcare AI assistant. Meridian helps care teams explore population health, understand member-level risk, and plan outreach in a responsible, policy-aware way. Always respect privacy and clinical appropriateness: do not invent PHI, cite tools and data when making quantitative claims, and encourage human review for clinical or coverage decisions.

GOVERNANCE CONTEXT:
- Current user role: ${role}
- Policy: ${policy.roleNote}
- Available tools: ${policy.allowedTools.join(", ")}
${policy.blockedFields.length > 0 ? `- Restricted fields (you cannot access): ${policy.blockedFields.join(", ")}` : "- No field restrictions for this role."}

IMPORTANT — Before calling any tools, ALWAYS start your response with a brief "Thinking" section wrapped in a markdown blockquote that explains your reasoning plan. Format:

> **Thinking:** [1-2 sentences explaining what you'll do and which tools you'll call and why]

Then proceed with the tool calls and final answer. This helps users understand your reasoning chain.`;
}

function createMeridianTools(role: GovernanceRole, userId: string) {
  const blocked = getBlockedFields(role);
  const roleNote = getRoleNote(role);

  return {
    identify_cohort: tool({
      description:
        "Find members matching geographic, clinical, and risk filters. Includes SDOH context and utilization data.",
      inputSchema: z.object({
        states: z.array(z.string()).describe("US state codes to include (empty = all)"),
        conditions: z.array(z.string()).describe("Chronic condition keywords to match (empty = all)"),
        riskTier: z.enum(["high", "medium", "low"]),
      }),
      execute: async (args) => {
        const filters = [eq(members.riskTier, args.riskTier)];
        if (args.states.length > 0) filters.push(inArray(members.state, args.states));
        if (args.conditions.length > 0) {
          const condOr = or(...args.conditions.map((c) => like(members.chronicConditions, `%${c}%`)));
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
            selectionExplanation: members.selectionExplanation,
            recommendedActions: members.recommendedActions,
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
          .where(and(...filters));

        const result = {
          count: rows.length,
          governance: { role, policyNote: roleNote, blockedFields: blocked },
          members: rows.map((m) => {
            const record = {
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
              selectionExplanation: m.selectionExplanation,
              recommendedActions: m.recommendedActions,
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
          }),
        };

        await writeAuditLog({
          userId,
          userRole: role,
          action: "identify_cohort",
          toolArgs: args,
          resultSummary: `${result.count} members matched`,
          blockedFields: blocked,
          policyNote: roleNote,
        });

        return result;
      },
    }),

    get_risk_drivers: tool({
      description: "Summarize key risk drivers for a member using members, SDOH, and pharmacy data.",
      inputSchema: z.object({ memberId: z.string() }),
      execute: async ({ memberId }) => {
        const member = await db.query.members.findFirst({ where: eq(members.id, memberId) });
        if (!member) return { error: "Member not found", drivers: [], member: null };

        const sdohRow = await db.query.sdoh.findFirst({ where: eq(sdoh.memberId, memberId) });
        const rxRows = await db.select().from(pharmacy).where(eq(pharmacy.memberId, memberId));

        const avgAdherence = rxRows.length === 0 ? null : rxRows.reduce((s, r) => s + r.adherencePct, 0) / rxRows.length;

        const drivers: { name: string; score: number; category: string }[] = [];
        drivers.push({ name: "Clinical risk score", score: Math.min(1, Math.max(0, member.riskScore)), category: "clinical" });

        if (sdohRow) {
          if (sdohRow.transportationFlag) drivers.push({ name: "Transportation access", score: 0.82, category: "sdoh" });
          if (sdohRow.foodInsecurity) drivers.push({ name: "Food insecurity", score: 0.78, category: "sdoh" });
          if (sdohRow.housingInstability) drivers.push({ name: "Housing instability", score: 0.75, category: "sdoh" });
        }
        if (avgAdherence !== null) {
          drivers.push({ name: "Medication adherence", score: Math.min(1, Math.max(0, 1 - avgAdherence / 100)), category: "pharmacy" });
        }
        if (member.erVisits12m >= 3) drivers.push({ name: "Frequent ER use", score: 0.85, category: "utilization" });
        if (member.pcpVisits12m === 0 && member.erVisits12m > 0) drivers.push({ name: "Low PCP engagement", score: 0.70, category: "utilization" });

        drivers.sort((a, b) => b.score - a.score);

        const result = sanitizeRecord({
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
            selectionExplanation: member.selectionExplanation,
          },
          pharmacyFillCount: rxRows.length,
          avgAdherencePct: avgAdherence,
          drivers,
          governance: { role, policyNote: roleNote, blockedFields: blocked },
        }, role);

        await writeAuditLog({
          userId, userRole: role, action: "get_risk_drivers",
          toolArgs: { memberId },
          resultSummary: `${drivers.length} drivers for ${member.memberReference}`,
          blockedFields: blocked, policyNote: roleNote,
        });

        return result;
      },
    }),

    explain_member: tool({
      description: "Produce a structured explanation for a member using all available data.",
      inputSchema: z.object({ memberId: z.string() }),
      execute: async ({ memberId }) => {
        const member = await db.query.members.findFirst({ where: eq(members.id, memberId) });
        if (!member) return { error: "Member not found" };

        const [sdohRow, rxRows, claimRows, utilRows] = await Promise.all([
          db.query.sdoh.findFirst({ where: eq(sdoh.memberId, memberId) }),
          db.select().from(pharmacy).where(eq(pharmacy.memberId, memberId)),
          db.select().from(claims).where(eq(claims.memberId, memberId)).orderBy(desc(claims.date)).limit(25),
          db.select().from(utilization).where(eq(utilization.memberId, memberId)),
        ]);

        const totalClaimAmount = claimRows.reduce((s, c) => s + c.amount, 0);
        const byType: Record<string, number> = {};
        for (const c of claimRows) byType[c.type] = (byType[c.type] ?? 0) + 1;

        const utilByType: Record<string, number> = {};
        for (const u of utilRows) utilByType[u.eventType] = (utilByType[u.eventType] ?? 0) + 1;

        const result = sanitizeRecord({
          sections: {
            overview: {
              title: "Overview",
              summary: `${member.name} is a ${member.age}-year-old ${member.gender} member in ${member.city}, ${member.state} with ${member.riskTier} risk (score ${member.riskScore}). ${member.selectionExplanation}`,
            },
            demographics: {
              title: "Demographics",
              id: member.id,
              memberReference: member.memberReference,
              name: member.name,
              state: member.state,
              city: member.city,
              metroArea: member.metroArea,
              age: member.age,
              gender: member.gender,
              pcpName: member.pcpName,
            },
            clinical: {
              title: "Clinical profile",
              chronicConditions: member.chronicConditions,
              riskScore: member.riskScore,
              riskTier: member.riskTier,
              hospitalVisitProb6m: member.hospitalVisitProb6m,
              riskDrivers: member.riskDrivers,
              recommendedActions: member.recommendedActions,
              selectionExplanation: member.selectionExplanation,
            },
            sdoh: {
              title: "Social determinants",
              transportationBarrier: sdohRow ? sdohRow.transportationFlag === 1 : null,
              foodInsecurity: sdohRow ? sdohRow.foodInsecurity === 1 : null,
              housingInstability: sdohRow ? sdohRow.housingInstability === 1 : null,
              financialStress: sdohRow ? sdohRow.financialStress === 1 : null,
              socialIsolation: sdohRow ? sdohRow.socialIsolation === 1 : null,
            },
            pharmacy: {
              title: "Pharmacy",
              fills: rxRows.map((r) => ({ drugName: r.drugName, drugClass: r.drugClass, adherencePct: r.adherencePct, fillDate: r.fillDate })),
            },
            utilization: {
              title: "Utilization",
              erVisits12m: member.erVisits12m,
              pcpVisits12m: member.pcpVisits12m,
              inpatientVisits12m: member.inpatientVisits12m,
              breakdown: utilByType,
            },
            claims: {
              title: "Recent claims",
              claimCount: claimRows.length,
              totalAmount: totalClaimAmount,
              countsByType: byType,
              recent: claimRows.slice(0, 8).map((c) => ({ date: c.date, type: c.type, amount: c.amount, icdCode: c.icdCode, provider: c.provider })),
            },
          },
          governance: { role, policyNote: roleNote, blockedFields: blocked },
        }, role);

        await writeAuditLog({
          userId, userRole: role, action: "explain_member",
          toolArgs: { memberId },
          resultSummary: `Explanation for ${member.memberReference}`,
          blockedFields: blocked, policyNote: roleNote,
        });

        return result;
      },
    }),

    recommend_outreach: tool({
      description: "Recommend next outreach actions from a member id and driver keywords.",
      inputSchema: z.object({
        memberId: z.string(),
        drivers: z.array(z.string()),
      }),
      execute: async ({ memberId, drivers: driverKeywords }) => {
        const member = await db.query.members.findFirst({ where: eq(members.id, memberId) });
        if (!member) return { error: "Member not found", recommendations: [] };

        const d = driverKeywords.map((x) => x.toLowerCase()).join(" ");
        const out: { action: string; priority: "high" | "medium" | "low"; rationale: string }[] = [];

        if (d.includes("transport") || d.includes("sdoh"))
          out.push({ action: "Offer transportation benefit navigation and scheduling assistance", priority: "high", rationale: "Transport barriers often drive missed care; proactive scheduling support reduces acute utilization." });
        if (d.includes("food") || d.includes("hunger"))
          out.push({ action: "Connect to food assistance programs and meal benefit review", priority: "high", rationale: "Food insecurity correlates with poor chronic disease control and higher utilization." });
        if (d.includes("adher") || d.includes("pharmacy") || d.includes("medication"))
          out.push({ action: "Pharmacist-led adherence call and 90-day fill where appropriate", priority: "medium", rationale: "Medication gaps are a modifiable driver of risk for chronic conditions." });
        if (member.riskTier === "high" || d.includes("clinical") || d.includes("risk"))
          out.push({ action: "Care manager outreach within 48 hours with personalized care plan review", priority: "high", rationale: `Member is ${member.riskTier} clinical risk; timely touchpoint can prevent escalation.` });
        if (d.includes("er") || d.includes("emergency"))
          out.push({ action: "Prioritize case management outreach and book rapid PCP follow-up", priority: "high", rationale: "Frequent ER use indicates potential care coordination gaps." });
        if (d.includes("pcp") || d.includes("engagement"))
          out.push({ action: "Coordinate PCP appointment and reinforce primary-care navigation", priority: "medium", rationale: "Low PCP engagement is associated with higher acute utilization." });

        if (out.length === 0) {
          out.push({ action: "Routine wellness check-in and care gap closure (preventive visits, labs)", priority: "medium", rationale: "No specific driver keyword matched; default proactive engagement for continuity of care." });
        }

        const result = {
          memberId,
          memberName: member.name,
          memberReference: member.memberReference,
          recommendations: out,
          governance: { role, policyNote: roleNote },
        };

        await writeAuditLog({
          userId, userRole: role, action: "recommend_outreach",
          toolArgs: { memberId, drivers: driverKeywords },
          resultSummary: `${out.length} recommendations for ${member.memberReference}`,
          blockedFields: blocked, policyNote: roleNote,
        });

        return result;
      },
    }),

    generate_chart: tool({
      description: "Build chart-ready aggregates from Turso. dataQuery guides which slice to chart.",
      inputSchema: z.object({
        chartType: z.enum(["bar", "pie", "line"]),
        dataQuery: z.string().describe("Natural language hint, e.g. by state, by risk tier, claims by type"),
      }),
      execute: async ({ chartType, dataQuery }) => {
        const q = dataQuery.toLowerCase();

        let rows: { name: string | null; value: number }[];
        let title: string;

        if (q.includes("claim")) {
          rows = await db.select({ name: claims.type, value: sql<number>`cast(count(*) as real)` }).from(claims).groupBy(claims.type);
          title = "Claims volume by type";
        } else if (q.includes("state")) {
          rows = await db.select({ name: members.state, value: sql<number>`cast(count(*) as real)` }).from(members).groupBy(members.state);
          title = "Members by state";
        } else if (q.includes("driver")) {
          rows = await db.select({ name: members.riskDrivers, value: sql<number>`cast(count(*) as real)` }).from(members).groupBy(members.riskDrivers);
          title = "Members by risk driver";
        } else if (q.includes("utilization") || q.includes("er") || q.includes("visit")) {
          rows = await db.select({ name: utilization.eventType, value: sql<number>`cast(count(*) as real)` }).from(utilization).groupBy(utilization.eventType);
          title = "Utilization events by type";
        } else {
          rows = await db.select({ name: members.riskTier, value: sql<number>`cast(count(*) as real)` }).from(members).groupBy(members.riskTier);
          title = "Members by risk tier";
        }

        const result = {
          type: chartType,
          title,
          data: rows.map((r) => ({ name: String(r.name), value: Number(r.value) })),
        };

        await writeAuditLog({
          userId, userRole: role, action: "generate_chart",
          toolArgs: { chartType, dataQuery },
          resultSummary: `Chart: ${title} (${rows.length} groups)`,
        });

        return result;
      },
    }),

    submit_feedback: tool({
      description: "Record a feedback request for product or model improvements.",
      inputSchema: z.object({
        requestText: z.string(),
        userRole: z.string(),
      }),
      execute: async ({ requestText, userRole }) => {
        const id = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        await db.insert(feedbackRequests).values({ id, userRole: userRole || role, requestText, status: "new", createdAt });

        await writeAuditLog({
          userId, userRole: role, action: "submit_feedback",
          toolArgs: { requestText: requestText.slice(0, 100) },
          resultSummary: `Feedback ${id} submitted`,
        });

        return { ok: true, id, message: "Feedback submitted for review.", createdAt };
      },
    }),
  };
}

export async function POST(req: Request) {
  const startMs = Date.now();

  let userId = "anonymous";
  let userRole: GovernanceRole = "care_manager";
  try {
    const session = await auth();
    if (session?.user) {
      userId = (session.user as any).id ?? session.user.email ?? "anonymous";
      const rawRole = (session.user as any).role ?? "care_manager";
      if (rawRole in ROLE_POLICIES) {
        userRole = rawRole as GovernanceRole;
      }
    }
  } catch {
    // fall back to defaults if auth unavailable
  }

  const body = await req.json();
  const { messages } = body as { messages?: unknown };
  if (!Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: "Expected messages array" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const lastUserMsg = [...(messages as any[])].reverse().find((m) => m.role === "user");
  const queryText =
    lastUserMsg?.parts?.find((p: any) => p.type === "text")?.text ??
    lastUserMsg?.content ??
    "unknown";

  const allTools = createMeridianTools(userRole, userId);
  const roleTools = filterToolsByRole(allTools, userRole) as typeof allTools;

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: buildSystemPrompt(userRole),
    messages: await convertToModelMessages(messages, { tools: roleTools }),
    tools: roleTools,
    stopWhen: stepCountIs(20),
    async onFinish({ usage }) {
      try {
        await db.insert(usageLog).values({
          id: crypto.randomUUID(),
          queryText: String(queryText).slice(0, 500),
          tokensIn: usage?.inputTokens ?? 0,
          tokensOut: usage?.outputTokens ?? 0,
          latencyMs: Date.now() - startMs,
          model: "gpt-4o-mini",
          createdAt: new Date().toISOString(),
        });
      } catch {
        // non-critical
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
