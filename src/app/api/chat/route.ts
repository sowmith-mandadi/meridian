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
} from "@/lib/schema";

const MERIDIAN_SYSTEM = `You are Meridian, a governed healthcare AI assistant. Meridian helps care teams explore population health, understand member-level risk, and plan outreach in a responsible, policy-aware way. Always respect privacy and clinical appropriateness: do not invent PHI, cite tools and data when making quantitative claims, and encourage human review for clinical or coverage decisions.

IMPORTANT — Before calling any tools, ALWAYS start your response with a brief "Thinking" section wrapped in a markdown blockquote that explains your reasoning plan. Format:

> **Thinking:** [1-2 sentences explaining what you'll do and which tools you'll call and why]

Then proceed with the tool calls and final answer. This helps users understand your reasoning chain.`;

const meridianTools = {
  identify_cohort: tool({
    description:
      "Find members matching geographic, clinical, and risk filters. Optionally includes SDOH context from a left join.",
    inputSchema: z.object({
      states: z.array(z.string()).describe("US state codes to include (empty = all)"),
      conditions: z
        .array(z.string())
        .describe("Chronic condition keywords to match in chronic_conditions (empty = all)"),
      riskTier: z.enum(["high", "medium", "low"]),
    }),
    execute: async ({ states, conditions: conditionTerms, riskTier }) => {
      const filters = [eq(members.riskTier, riskTier)];

      if (states.length > 0) {
        filters.push(inArray(members.state, states));
      }

      if (conditionTerms.length > 0) {
        const condOr = or(
          ...conditionTerms.map((c) => like(members.chronicConditions, `%${c}%`)),
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
            housingInstability: m.sdohHousing === 1,
          },
        })),
      };
    },
  }),

  get_risk_drivers: tool({
    description:
      "Summarize key risk drivers for a member using members, SDOH, and pharmacy data.",
    inputSchema: z.object({
      memberId: z.string(),
    }),
    execute: async ({ memberId }) => {
      const member = await db.query.members.findFirst({
        where: eq(members.id, memberId),
      });
      if (!member) {
        return { error: "Member not found", drivers: [], member: null };
      }

      const sdohRow = await db.query.sdoh.findFirst({
        where: eq(sdoh.memberId, memberId),
      });

      const rxRows = await db
        .select()
        .from(pharmacy)
        .where(eq(pharmacy.memberId, memberId));

      const avgAdherence =
        rxRows.length === 0
          ? null
          : rxRows.reduce((s, r) => s + r.adherencePct, 0) / rxRows.length;

      const drivers: { name: string; score: number; category: string }[] = [];

      drivers.push({
        name: "Clinical risk score",
        score: Math.min(1, Math.max(0, member.riskScore)),
        category: "clinical",
      });

      if (sdohRow) {
        if (sdohRow.transportationFlag) {
          drivers.push({
            name: "Transportation access",
            score: 0.82,
            category: "sdoh",
          });
        }
        if (sdohRow.foodInsecurity) {
          drivers.push({
            name: "Food insecurity",
            score: 0.78,
            category: "sdoh",
          });
        }
        if (sdohRow.housingInstability) {
          drivers.push({
            name: "Housing instability",
            score: 0.75,
            category: "sdoh",
          });
        }
      }

      if (avgAdherence !== null) {
        const adherenceRisk = 1 - avgAdherence / 100;
        drivers.push({
          name: "Medication adherence",
          score: Math.min(1, Math.max(0, adherenceRisk)),
          category: "pharmacy",
        });
      }

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
    },
  }),

  explain_member: tool({
    description:
      "Produce a structured explanation for a member using member, SDOH, pharmacy, and claims data.",
    inputSchema: z.object({
      memberId: z.string(),
    }),
    execute: async ({ memberId }) => {
      const member = await db.query.members.findFirst({
        where: eq(members.id, memberId),
      });
      if (!member) {
        return { error: "Member not found" };
      }

      const [sdohRow, rxRows, claimRows] = await Promise.all([
        db.query.sdoh.findFirst({ where: eq(sdoh.memberId, memberId) }),
        db.select().from(pharmacy).where(eq(pharmacy.memberId, memberId)),
        db
          .select()
          .from(claims)
          .where(eq(claims.memberId, memberId))
          .orderBy(desc(claims.date))
          .limit(25),
      ]);

      const totalClaimAmount = claimRows.reduce((s, c) => s + c.amount, 0);
      const byType: Record<string, number> = {};
      for (const c of claimRows) {
        byType[c.type] = (byType[c.type] ?? 0) + 1;
      }

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
            fills: rxRows.map((r) => ({
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
            recent: claimRows.slice(0, 8).map((c) => ({
              date: c.date,
              type: c.type,
              amount: c.amount,
              icdCode: c.icdCode,
              provider: c.provider,
            })),
          },
        },
      };
    },
  }),

  recommend_outreach: tool({
    description:
      "Recommend next outreach actions from a member id and driver keywords.",
    inputSchema: z.object({
      memberId: z.string(),
      drivers: z.array(z.string()),
    }),
    execute: async ({ memberId, drivers }) => {
      const member = await db.query.members.findFirst({
        where: eq(members.id, memberId),
      });
      if (!member) {
        return { error: "Member not found", recommendations: [] };
      }

      const d = drivers.map((x) => x.toLowerCase()).join(" ");
      const out: { action: string; priority: "high" | "medium" | "low"; rationale: string }[] =
        [];

      if (d.includes("transport") || d.includes("sdoh")) {
        out.push({
          action: "Offer transportation benefit navigation and scheduling assistance",
          priority: "high",
          rationale: "Transport barriers often drive missed care; proactive scheduling support reduces acute utilization.",
        });
      }
      if (d.includes("food") || d.includes("hunger")) {
        out.push({
          action: "Connect to food assistance programs and meal benefit review",
          priority: "high",
          rationale: "Food insecurity correlates with poor chronic disease control and higher utilization.",
        });
      }
      if (d.includes("adher") || d.includes("pharmacy") || d.includes("medication")) {
        out.push({
          action: "Pharmacist-led adherence call and 90-day fill where appropriate",
          priority: "medium",
          rationale: "Medication gaps are a modifiable driver of risk for chronic conditions.",
        });
      }
      if (member.riskTier === "high" || d.includes("clinical") || d.includes("risk")) {
        out.push({
          action: "Care manager outreach within 48 hours with personalized care plan review",
          priority: "high",
          rationale: `Member is ${member.riskTier} clinical risk; timely touchpoint can prevent escalation.`,
        });
      }

      if (out.length === 0) {
        out.push({
          action: "Routine wellness check-in and care gap closure (preventive visits, labs)",
          priority: "medium",
          rationale: "No specific driver keyword matched; default proactive engagement for continuity of care.",
        });
      }

      return { memberId, memberName: member.name, recommendations: out };
    },
  }),

  generate_chart: tool({
    description:
      "Build chart-ready aggregates from Turso using Drizzle/SQL. dataQuery guides which slice to chart.",
    inputSchema: z.object({
      chartType: z.enum(["bar", "pie", "line"]),
      dataQuery: z
        .string()
        .describe(
          "Natural language hint, e.g. by state, by risk tier, claims by type",
        ),
    }),
    execute: async ({ chartType, dataQuery }) => {
      const q = dataQuery.toLowerCase();

      if (q.includes("claim")) {
        const rows = await db
          .select({
            name: claims.type,
            value: sql<number>`cast(count(*) as real)`,
          })
          .from(claims)
          .groupBy(claims.type);

        return {
          type: chartType,
          title: "Claims volume by type",
          data: rows.map((r) => ({
            name: String(r.name),
            value: Number(r.value),
          })),
        };
      }

      if (q.includes("state")) {
        const rows = await db
          .select({
            name: members.state,
            value: sql<number>`cast(count(*) as real)`,
          })
          .from(members)
          .groupBy(members.state);

        return {
          type: chartType,
          title: "Members by state",
          data: rows.map((r) => ({
            name: String(r.name),
            value: Number(r.value),
          })),
        };
      }

      if (q.includes("tier") || q.includes("risk")) {
        const rows = await db
          .select({
            name: members.riskTier,
            value: sql<number>`cast(count(*) as real)`,
          })
          .from(members)
          .groupBy(members.riskTier);

        return {
          type: chartType,
          title: "Members by risk tier",
          data: rows.map((r) => ({
            name: String(r.name),
            value: Number(r.value),
          })),
        };
      }

      const rows = await db
        .select({
          name: members.riskTier,
          value: sql<number>`cast(count(*) as real)`,
        })
        .from(members)
        .groupBy(members.riskTier);

      return {
        type: chartType,
        title: "Population distribution by risk tier (default)",
        data: rows.map((r) => ({
          name: String(r.name),
          value: Number(r.value),
        })),
      };
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

      await db.insert(feedbackRequests).values({
        id,
        userRole,
        requestText,
        status: "new",
        createdAt,
      });

      return {
        ok: true,
        id,
        message: "Feedback submitted for review.",
        createdAt,
      };
    },
  }),
};

export async function POST(req: Request) {
  const startMs = Date.now();
  const body = await req.json();
  const { messages } = body as { messages?: unknown };
  if (!Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: "Expected messages array" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const lastUserMsg =
    [...(messages as any[])].reverse().find((m) => m.role === "user");
  const queryText =
    lastUserMsg?.parts?.find((p: any) => p.type === "text")?.text ??
    lastUserMsg?.content ??
    "unknown";

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: MERIDIAN_SYSTEM,
    messages: await convertToModelMessages(messages, { tools: meridianTools }),
    tools: meridianTools,
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
        // non-critical — don't fail the chat if logging fails
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
