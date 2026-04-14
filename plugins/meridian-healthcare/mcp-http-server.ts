#!/usr/bin/env npx tsx
/**
 * Meridian Healthcare MCP Server — HTTP transport
 *
 * Runs the same MCP server over Streamable HTTP so Codex can connect via URL.
 * Start with: npx tsx plugins/meridian-healthcare/mcp-http-server.ts
 * Then point Codex at: http://localhost:8787/mcp
 */

import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const API_URL = process.env.MERIDIAN_API_URL || "http://localhost:3000";
const PORT = Number(process.env.MCP_PORT || 8787);

// ── Proxy helpers ───────────────────────────────────────────────────────────

async function proxyChat(toolName: string, args: Record<string, unknown>) {
  const messages = [{ role: "user", content: `Call the ${toolName} tool with these arguments: ${JSON.stringify(args)}. Return ONLY the raw tool result as JSON, nothing else.` }];
  const res = await fetch(`${API_URL}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages }) });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return await res.text();
}

async function proxyGovernedQuery(args: Record<string, unknown>) {
  const res = await fetch(`${API_URL}/api/collaborate/query`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args) });
  if (!res.ok) throw new Error(`Governed query error: ${res.status}`);
  return await res.json();
}

async function proxyPipeline() {
  const res = await fetch(`${API_URL}/api/pipeline`, { method: "POST" });
  if (!res.ok) throw new Error(`Pipeline error: ${res.status}`);
  const text = await res.text();
  return text.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

// ── Governance policy (local, no DB needed) ─────────────────────────────────

const ROLE_POLICIES: Record<string, { allowedTools: string[]; allowedIntents: string[]; blockedFields: string[]; roleNote: string }> = {
  care_manager: { allowedTools: ["identify_cohort", "get_risk_drivers", "explain_member", "recommend_outreach", "generate_chart", "submit_feedback"], allowedIntents: ["cohort", "member_outreach", "pharmacy_review", "quality_gap", "provider_coordination"], blockedFields: [], roleNote: "Care management has full access to all tools, SDOH, explanations, and outreach with masked member identifiers." },
  analyst: { allowedTools: ["identify_cohort", "get_risk_drivers", "generate_chart", "submit_feedback"], allowedIntents: ["cohort", "pharmacy_review"], blockedFields: ["transportationBarrier", "foodInsecurity", "housingInstability", "financialStress", "socialIsolation", "recommendedActions", "selectionExplanation"], roleNote: "Analyst/pharmacy role can view adherence and drug-class data. SDOH detail fields and outreach recommendations are BLOCKED." },
  quality: { allowedTools: ["identify_cohort", "generate_chart", "submit_feedback"], allowedIntents: ["aggregate", "quality_gap", "cohort"], blockedFields: ["transportationBarrier", "foodInsecurity", "housingInstability", "financialStress", "socialIsolation", "recommendedActions", "selectionExplanation", "pcpName"], roleNote: "Quality users receive aggregate compliance and gap analysis only. SDOH, outreach, and provider names are BLOCKED." },
  admin: { allowedTools: ["identify_cohort", "get_risk_drivers", "explain_member", "recommend_outreach", "generate_chart", "submit_feedback", "governed_query"], allowedIntents: ["cohort", "member_outreach", "pharmacy_review", "quality_gap", "provider_coordination", "aggregate"], blockedFields: [], roleNote: "Administrative access with full data visibility and governance review capabilities." },
};

// ── MCP Server ──────────────────────────────────────────────────────────────

const server = new McpServer({ name: "meridian-healthcare", version: "1.0.0" });

server.tool("check_governance", "GOVERNANCE GATE — Preview governance rules for a role and intent BEFORE executing. The agent MUST present this to the user and ask for confirmation.", {
  role: z.enum(["care_manager", "analyst", "quality", "admin"]),
  intent: z.string(),
}, async (args) => {
  const role = args.role in ROLE_POLICIES ? args.role : "care_manager";
  const policy = ROLE_POLICIES[role];
  const allowed = policy.allowedIntents.includes(args.intent);
  return { content: [{ type: "text" as const, text: JSON.stringify({
    governancePreview: true, role, intent: args.intent, intentAllowed: allowed,
    decision: allowed ? "ALLOWED — proceed with user confirmation" : "BLOCKED — this role cannot perform this intent",
    policyNote: policy.roleNote,
    allowedTools: policy.allowedTools,
    blockedFields: policy.blockedFields.length > 0 ? policy.blockedFields : ["(none — full access)"],
    fieldMaskingSummary: policy.blockedFields.length > 0 ? `${policy.blockedFields.length} fields will be redacted: ${policy.blockedFields.join(", ")}` : "No fields will be redacted — full visibility for this role.",
    auditNote: "This query will be logged to the governance audit trail.",
    userConfirmationRequired: true,
    confirmationPrompt: allowed
      ? `Governance check passed for role "${role}" with intent "${args.intent}". ${policy.blockedFields.length > 0 ? `${policy.blockedFields.length} SDOH/outreach fields will be masked.` : "Full data access granted."} Shall I proceed?`
      : `GOVERNANCE BLOCK: Role "${role}" is NOT authorized for intent "${args.intent}". Allowed intents: ${policy.allowedIntents.join(", ")}.`,
  }, null, 2) }] };
});

server.tool("request_governed_access", "FULL GOVERNED ACCESS — Human-in-the-loop flow. Set userConfirmed=true ONLY after user approves.", {
  role: z.enum(["care_manager", "analyst", "quality", "admin"]),
  intent: z.string(),
  filters: z.object({ states: z.array(z.string()).optional(), riskTier: z.string().optional(), conditions: z.array(z.string()).optional(), diabetesOnly: z.boolean().optional(), minErVisits: z.number().optional(), maxPcpVisits: z.number().optional(), metroAreaContains: z.string().optional(), adherenceBelow: z.number().optional() }).optional(),
  scope: z.enum(["aggregated", "member_level"]).optional(),
  limit: z.number().optional(),
  userConfirmed: z.boolean(),
}, async (args) => {
  const role = args.role in ROLE_POLICIES ? args.role : "care_manager";
  const policy = ROLE_POLICIES[role];
  if (!policy.allowedIntents.includes(args.intent)) {
    return { content: [{ type: "text" as const, text: JSON.stringify({ step: "GOVERNANCE_BLOCK", status: "rejected", role, intent: args.intent, reason: `Role "${role}" is not authorized for "${args.intent}" queries.`, allowedIntents: policy.allowedIntents }, null, 2) }] };
  }
  if (!args.userConfirmed) {
    return { content: [{ type: "text" as const, text: JSON.stringify({ step: "AWAITING_USER_CONFIRMATION", status: "pending", role, intent: args.intent, policyNote: policy.roleNote, blockedFields: policy.blockedFields, scope: args.scope ?? "member_level", filters: args.filters ?? {}, confirmationPrompt: `Query as "${role}". ${policy.blockedFields.length > 0 ? `${policy.blockedFields.length} fields masked.` : "Full access."} Approve?` }, null, 2) }] };
  }
  const result = await proxyGovernedQuery({ role, intent: args.intent, filters: args.filters, scope: args.scope, limit: args.limit ?? 15 });
  return { content: [{ type: "text" as const, text: JSON.stringify({ step: "QUERY_EXECUTED", status: "completed", governanceApplied: true, userConfirmed: true, ...result }, null, 2) }] };
});

server.tool("identify_cohort", "Find members matching geographic, clinical, and risk filters with SDOH context", {
  states: z.array(z.string()), conditions: z.array(z.string()), riskTier: z.enum(["high", "medium", "low"]),
}, async (args) => {
  const result = JSON.parse(await proxyChat("identify_cohort", args));
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
});

server.tool("get_risk_drivers", "Analyze top risk drivers for a member", { memberId: z.string() }, async (args) => {
  const result = JSON.parse(await proxyChat("get_risk_drivers", args));
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
});

server.tool("explain_member", "Structured explanation for a member's risk", { memberId: z.string() }, async (args) => {
  const result = JSON.parse(await proxyChat("explain_member", args));
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
});

server.tool("recommend_outreach", "Suggest prioritized interventions", { memberId: z.string(), drivers: z.array(z.string()) }, async (args) => {
  const result = JSON.parse(await proxyChat("recommend_outreach", args));
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
});

server.tool("generate_chart", "Build chart-ready aggregates", { chartType: z.enum(["bar", "pie", "line"]), dataQuery: z.string() }, async (args) => {
  const result = JSON.parse(await proxyChat("generate_chart", args));
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
});

server.tool("submit_feedback", "Record feedback", { requestText: z.string(), userRole: z.string() }, async (args) => {
  const result = JSON.parse(await proxyChat("submit_feedback", args));
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
});

server.tool("governed_query", "Execute a governed A2A query with role-based access control", {
  role: z.enum(["care_manager", "analyst", "quality", "admin"]),
  intent: z.string(),
  filters: z.object({ states: z.array(z.string()).optional(), riskTier: z.string().optional(), conditions: z.array(z.string()).optional(), diabetesOnly: z.boolean().optional() }).optional(),
  scope: z.enum(["aggregated", "member_level"]).optional(),
  limit: z.number().optional(),
}, async (args) => {
  const result = await proxyGovernedQuery(args);
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
});

server.tool("run_pipeline", "Execute the 5-step data pipeline", {}, async () => {
  const result = await proxyPipeline();
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
});

// ── HTTP Server ─────────────────────────────────────────────────────────────

const transports = new Map<string, StreamableHTTPServerTransport>();

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", server: "meridian-healthcare", transport: "streamable-http", tools: 10 }));
    return;
  }

  if (url.pathname === "/mcp") {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => crypto.randomUUID() });
    transports.set(transport.sessionId!, transport);
    transport.onclose = () => { transports.delete(transport.sessionId!); };
    await server.connect(transport);
    await transport.handleRequest(req, res);
    return;
  }

  // Handle session-based requests
  const sessionId = req.headers["mcp-session-id"] as string;
  if (sessionId && transports.has(sessionId)) {
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/mcp") {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => crypto.randomUUID() });
    transports.set(transport.sessionId!, transport);
    transport.onclose = () => { transports.delete(transport.sessionId!); };
    await server.connect(transport);
    await transport.handleRequest(req, res);
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found. Use /mcp for MCP or /health for status." }));
});

httpServer.listen(PORT, () => {
  console.log(`Meridian MCP HTTP server running at http://localhost:${PORT}/mcp`);
  console.log(`Proxying to: ${API_URL}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
