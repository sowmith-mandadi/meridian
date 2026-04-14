---
name: governed-access
description: Demonstrates governed agent-to-agent data access with human-in-the-loop approval. Use when a Codex agent needs healthcare data and must go through the governance gate with user confirmation.
---

# Governed Access Skill

Execute healthcare data queries through the full governance lifecycle with user input at every decision point.

## When to use

Use this skill when:
- Querying member data on behalf of a specific team role
- Demonstrating the A2A governance flow
- The user asks about governed access, role-based permissions, or field masking
- Running the governance demo

## Protocol — FOLLOW THESE STEPS EXACTLY

### Step 1: Present role options to the user

Before doing anything, ask the user which role they want to query as. Present these four options clearly:

| Role | Access Level | What's Blocked |
|------|-------------|----------------|
| **Care Manager** | Full access — all tools, SDOH, outreach, explanations | Nothing blocked |
| **Analyst / Pharmacy** | Adherence and drug data visible | SDOH detail, outreach recommendations, selection explanations |
| **Quality** | Aggregate compliance and gap analysis | SDOH detail, outreach, provider names |
| **Admin** | Full administrative access | Nothing blocked |

**Wait for the user to pick a role before proceeding.**

### Step 2: Check governance rules

Once the user picks a role, call `check_governance` from the `meridian` MCP server:

```
MCP tool: check_governance
Server: meridian
Input: { "role": "<chosen_role>", "intent": "<query_intent>" }
```

Present the governance preview to the user. Highlight:
- Whether the intent is **ALLOWED** or **BLOCKED**
- The **policy note** explaining what this role can see
- The **blocked fields** list (if any)
- The **field masking summary** (how many fields will be redacted)
- That the query **will be logged** to the audit trail

If the intent is blocked, explain why and ask the user to pick a different role or intent. Do NOT proceed.

### Step 3: Ask for explicit confirmation

Present a clear confirmation prompt to the user:

> "I'm about to query healthcare data as **[role]**. [X fields will be masked / Full access granted]. The query will be logged to the governance audit. Do you approve?"

**Wait for the user to explicitly confirm before proceeding.**

### Step 4: Execute the governed query

Only after user confirmation, call `request_governed_access`:

```
MCP tool: request_governed_access
Server: meridian
Input: {
  "role": "<chosen_role>",
  "intent": "<intent>",
  "filters": { ... },
  "scope": "member_level" or "aggregated",
  "limit": 15,
  "userConfirmed": true
}
```

### Step 5: Present results with governance metadata

Show the results to the user with clear governance annotations:
- **Role applied**: which role was used
- **Fields blocked**: which columns were redacted (if any)
- **Audit ID**: the unique audit trail reference
- **Policy enforced**: the governance note
- **Record count**: how many members matched

Each record now includes **riskDriversDetail**, **outreachRecommendations**, and **pharmacySummary** inline — no follow-up tool calls needed for most workflows.

If fields were blocked, explicitly note which fields the user CANNOT see due to their role.

### Step 6 (optional): Deep-dive on a specific member

If the user wants more detail on a specific member from the results, use `governed_member_detail`:

```
MCP tool: governed_member_detail
Server: meridian
Input: {
  "memberReference": "MBR-478",
  "role": "<same role as step 4>",
  "auditId": "<auditId from step 5 governance metadata>"
}
```

This returns full risk drivers, outreach plan, pharmacy fills, claims history, and explanation — all within the same governance boundary. The audit trail links back to the original query via `parentAuditId`.

## Example demo flow

**User**: "Show me high-risk diabetic members in Texas"

**Agent (Step 1)**: "Which role would you like to query as? Here are your options: [table of 4 roles]"

**User**: "Analyst"

**Agent (Step 2)**: Calls `check_governance` with role=analyst, intent=cohort. Presents: "As an Analyst, you have access to cohort queries. However, 7 SDOH fields and outreach recommendations will be masked. The query will be audit-logged."

**Agent (Step 3)**: "Do you approve this governed access?"

**User**: "Yes"

**Agent (Step 4)**: Calls `request_governed_access` with userConfirmed=true.

**Agent (Step 5)**: Shows results with: "12 high-risk diabetic members in TX. Fields blocked: transportationBarrier, foodInsecurity, housingInstability, financialStress, socialIsolation, recommendedActions, selectionExplanation. Audit ID: abc-123."

## Comparison demo

For maximum impact, run the same query as two different roles to show the difference:

1. Run as **Care Manager** — full results with SDOH and outreach
2. Run as **Analyst** — same members but SDOH and outreach masked

## Do not

- Do NOT skip the role selection step — always ask the user
- Do NOT skip the governance check — always call `check_governance` first
- Do NOT execute the query without explicit user confirmation
- Do NOT call `governed_query` directly — use `request_governed_access` for the full flow
- Do NOT call `get_risk_drivers`, `explain_member`, or `recommend_outreach` with governed masked references — use the inline data from `request_governed_access` or `governed_member_detail` instead
- Do NOT read source files or write scripts
