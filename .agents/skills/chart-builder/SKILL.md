---
name: chart-builder
description: Builds chart-ready data aggregates from the healthcare database. Use when generating visualizations for population health metrics.
---

# Chart Builder Skill

Generate Recharts-compatible aggregated data.

## How to execute

Use the `meridian` MCP server tool `generate_chart`. Do NOT read source code or write scripts.

```
MCP tool: generate_chart
Server: meridian
```

## Input

```json
{
  "chartType": "bar",
  "dataQuery": "members by risk tier"
}
```

- `chartType`: One of "bar", "pie", "line".
- `dataQuery`: Natural language hint. Keywords trigger specific aggregations:

| Keyword | Aggregation |
|---------|------------|
| "state" | Members grouped by state |
| "tier", "risk" | Members grouped by risk tier |
| "claim" | Claims grouped by type |
| (default) | Risk tier distribution |

## Output

```json
{
  "type": "bar",
  "title": "Members by risk tier",
  "data": [
    { "name": "high", "value": 136 },
    { "name": "medium", "value": 176 },
    { "name": "low", "value": 188 }
  ]
}
```

## Do not

- Do NOT read source files or schema definitions
- Do NOT write SQL or TypeScript
- ONLY use `generate_chart` from the `meridian` MCP server
