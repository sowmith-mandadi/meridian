---
name: outreach-plan
description: Generates prioritized outreach recommendations for healthcare members based on risk drivers. Use when recommending interventions.
---

# Outreach Plan Skill

Create actionable outreach recommendations mapped to risk drivers.

## How to execute

Use the `meridian` MCP server tool `recommend_outreach`. Do NOT read source code or write scripts.

```
MCP tool: recommend_outreach
Server: meridian
```

## Input

```json
{
  "memberId": "M-1042",
  "drivers": ["transportation", "medication adherence"]
}
```

- `memberId`: The member ID to generate outreach for.
- `drivers`: Array of risk driver keywords. The tool maps these to specific interventions.

## Driver-to-action mapping

| Driver keyword | Action generated |
|---------------|-----------------|
| transport, sdoh | Transportation benefit navigation |
| food, hunger | Food assistance programs |
| adher, pharmacy, medication | Pharmacist-led adherence call |
| clinical, risk | Care manager outreach within 48h |

## Output

```json
{
  "memberId": "M-1042",
  "memberName": "...",
  "recommendations": [
    { "action": "...", "priority": "high", "rationale": "..." }
  ]
}
```

## Do not

- Do NOT read source files
- Do NOT write scripts
- ONLY use `recommend_outreach` from the `meridian` MCP server
