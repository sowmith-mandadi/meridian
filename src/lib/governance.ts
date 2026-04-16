import "server-only";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/schema";

export type GovernanceRole = "care_manager" | "analyst" | "quality" | "admin";

interface RolePolicy {
  allowedTools: string[];
  blockedFields: string[];
  allowedIntents: string[];
  roleNote: string;
}

export const ROLE_POLICIES: Record<GovernanceRole, RolePolicy> = {
  care_manager: {
    allowedTools: [
      "identify_cohort",
      "get_risk_drivers",
      "explain_member",
      "recommend_outreach",
      "generate_chart",
      "submit_feedback",
    ],
    blockedFields: [],
    allowedIntents: ["cohort", "member_outreach", "pharmacy_review", "quality_gap", "provider_coordination"],
    roleNote: "Care management has full access with masked member identifiers.",
  },
  analyst: {
    allowedTools: [
      "identify_cohort",
      "get_risk_drivers",
      "generate_chart",
      "submit_feedback",
    ],
    blockedFields: [
      "transportationBarrier",
      "foodInsecurity",
      "housingInstability",
      "financialStress",
      "socialIsolation",
      "sdoh",
      "recommendedActions",
      "selectionExplanation",
      "recommended_actions",
      "selection_explanation",
    ],
    allowedIntents: ["cohort", "pharmacy_review"],
    roleNote:
      "Pharmacy/analyst role can view adherence and drug-class data; SDOH and outreach recommendations are restricted.",
  },
  quality: {
    allowedTools: ["identify_cohort", "generate_chart", "submit_feedback"],
    blockedFields: [
      "transportationBarrier",
      "foodInsecurity",
      "housingInstability",
      "financialStress",
      "socialIsolation",
      "sdoh",
      "recommendedActions",
      "selectionExplanation",
      "recommended_actions",
      "selection_explanation",
      "pcpName",
      "pcp_name",
    ],
    allowedIntents: ["aggregate", "quality_gap", "cohort"],
    roleNote:
      "Quality users receive aggregate compliance and gap analysis; individualized outreach is restricted.",
  },
  admin: {
    allowedTools: [
      "identify_cohort",
      "get_risk_drivers",
      "explain_member",
      "recommend_outreach",
      "generate_chart",
      "submit_feedback",
    ],
    blockedFields: [],
    allowedIntents: ["cohort", "member_outreach", "pharmacy_review", "quality_gap", "provider_coordination", "aggregate"],
    roleNote: "Administrative access for governance review and full data visibility.",
  },
};

const TEXT_SANITIZATION: Record<string, string> = {
  "transportation barrier": "restricted social barrier",
  "food insecurity": "restricted social barrier",
  "housing instability": "restricted social barrier",
  "social complexity": "restricted social barrier",
  "social isolation": "restricted social barrier",
  "financial stress": "restricted social barrier",
};

export function isToolAllowed(role: GovernanceRole, toolName: string): boolean {
  const policy = ROLE_POLICIES[role];
  if (!policy) return false;
  return policy.allowedTools.includes(toolName);
}

export function isIntentAllowed(role: GovernanceRole, intent: string): boolean {
  const policy = ROLE_POLICIES[role];
  if (!policy) return false;
  return policy.allowedIntents.includes(intent);
}

export function getBlockedFields(role: GovernanceRole): string[] {
  return ROLE_POLICIES[role]?.blockedFields ?? [];
}

export function getRoleNote(role: GovernanceRole): string {
  return ROLE_POLICIES[role]?.roleNote ?? "Unknown role.";
}

export function sanitizeRecord<T extends Record<string, unknown>>(
  record: T,
  role: GovernanceRole,
): Partial<T> {
  const blocked = new Set(getBlockedFields(role));
  if (blocked.size === 0) return { ...record };

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (blocked.has(key)) continue;
    if (typeof value === "string" && (key === "riskDrivers" || key === "risk_drivers")) {
      result[key] = sanitizeText(value, role);
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = sanitizeRecord(value as Record<string, unknown>, role);
    } else {
      result[key] = value;
    }
  }
  return result as Partial<T>;
}

export function sanitizeText(text: string, role: GovernanceRole): string {
  if (role === "care_manager" || role === "admin") return text;
  let sanitized = text;
  for (const [source, target] of Object.entries(TEXT_SANITIZATION)) {
    sanitized = sanitized.replaceAll(source, target);
  }
  return sanitized;
}

export function filterToolsByRole(
  allTools: Record<string, unknown>,
  role: GovernanceRole,
): Record<string, unknown> {
  const allowed = new Set(ROLE_POLICIES[role]?.allowedTools ?? []);
  const filtered: Record<string, unknown> = {};
  for (const [name, def] of Object.entries(allTools)) {
    if (allowed.has(name)) {
      filtered[name] = def;
    }
  }
  return filtered;
}

export async function writeAuditLog(params: {
  userId: string;
  userRole: string;
  action: string;
  toolArgs?: Record<string, unknown>;
  resultSummary?: string;
  blockedFields?: string[];
  policyNote?: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  try {
    await db.insert(auditLog).values({
      id,
      userId: params.userId,
      userRole: params.userRole,
      action: params.action,
      toolArgs: JSON.stringify(params.toolArgs ?? {}),
      resultSummary: params.resultSummary ?? "",
      blockedFields: (params.blockedFields ?? []).join(", "),
      policyNote: params.policyNote ?? "",
      createdAt: new Date().toISOString(),
    });
  } catch {
    // non-critical
  }
  return id;
}
