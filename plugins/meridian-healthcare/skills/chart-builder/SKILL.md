---
name: chart-builder
description: Builds chart-ready data aggregates from Meridian's healthcare database. Use when generating visualizations for population health metrics.
---

# Chart Builder Skill

Generate Recharts-compatible data from Drizzle/SQL aggregations.

## Supported Chart Types

- `bar` — grouped counts or averages (members by state, claims by type)
- `pie` — distribution breakdowns (risk tier distribution)
- `line` — time series (claims over months, not yet implemented)

## Query Routing

Parse the `dataQuery` string to decide which aggregation to run:

| Keyword | Query |
|---------|-------|
| "state" | `SELECT state, count(*) FROM members GROUP BY state` |
| "tier", "risk" | `SELECT risk_tier, count(*) FROM members GROUP BY risk_tier` |
| "claim" | `SELECT type, count(*) FROM claims GROUP BY type` |
| default | Risk tier distribution as fallback |

## Output Format

```json
{
  "type": "bar",
  "title": "Members by risk tier",
  "data": [
    { "name": "high", "value": 159 },
    { "name": "medium", "value": 176 },
    { "name": "low", "value": 165 }
  ]
}
```

## Recharts Integration

The UI renders this data with:
```tsx
<BarChart data={data}>
  <XAxis dataKey="name" />
  <YAxis />
  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
</BarChart>
```
