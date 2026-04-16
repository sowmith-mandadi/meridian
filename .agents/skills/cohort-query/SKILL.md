---

## name: cohort-query
description: Identifies healthcare member cohorts by state, condition, risk tier, and SDOH indicators. Use when filtering populations for analysis or outreach.

# Cohort Query Skill

Find member cohorts from the Meridian healthcare database.

## How to execute

Use the `meridian` MCP server tool `identify_cohort`. Do NOT read source code, write scripts, or query the database directly.

```
MCP tool: identify_cohort
Server: meridian
```

## Input

```json
{
  "states": ["TX", "FL"],
  "conditions": ["Diabetes"],
  "riskTier": "high"
}
```

- `states`: US state codes. Empty array = all states.
- `conditions`: Chronic condition keywords to match. Empty = all.
- `riskTier`: One of "high", "medium", "low".

## Output

```json
{
  "count": 47,
  "members": [
    {
      "id": "M-1042",
      "name": "...",
      "state": "TX",
      "riskScore": 0.82,
      "riskTier": "high",
      "chronicConditions": "Diabetes Type 2, CHF",
      "sdoh": {
        "transportationBarrier": true,
        "foodInsecurity": false,
        "housingInstability": false
      }
    }
  ]
}
```

## Do not

- Do NOT read `src/lib/schema.ts` or any source files
- Do NOT write or execute TypeScript scripts
- Do NOT use the `turso_healthcare_db` MCP server directly
- ONLY use the `identify_cohort` tool from the `meridian` MCP server

