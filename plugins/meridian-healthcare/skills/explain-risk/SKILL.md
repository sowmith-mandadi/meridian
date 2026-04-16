---
name: explain-risk
description: Generates plain-language explanations of why a healthcare member was flagged as high-risk. Use when creating member-level risk narratives.
---

# Explain Risk Skill

Produce structured explanations for member risk flags.

## How to execute

Use two `meridian` MCP server tools in sequence:

1. `get_risk_drivers` — get scored risk drivers
2. `explain_member` — get full structured explanation

Do NOT read source code, write scripts, or query the database directly.

## Tool 1: get_risk_drivers

```
MCP tool: get_risk_drivers
Server: meridian
Input: { "memberId": "M-1042" }
```

Returns drivers ranked by score (0-1): clinical risk, transportation, food insecurity, housing, medication adherence.

## Tool 2: explain_member

```
MCP tool: explain_member
Server: meridian
Input: { "memberId": "M-1042" }
```

Returns structured sections: overview, demographics, clinical, SDOH, pharmacy fills, recent claims.

## Do not

- Do NOT read `src/` files or `scripts/`
- Do NOT write or execute TypeScript
- ONLY use `get_risk_drivers` and `explain_member` from the `meridian` MCP server
