---
name: cohort-query
description: Generates Drizzle ORM queries to identify healthcare member cohorts from Meridian's Turso database. Use when filtering members by state, condition, risk tier, or SDOH indicators.
---

# Cohort Query Skill

Generate type-safe Drizzle ORM queries against Meridian's schema to find member cohorts.

## Schema

- `members`: id, name, state, age, gender, risk_score, risk_tier, chronic_conditions
- `sdoh`: member_id, transportation_flag, food_insecurity, housing_instability
- `pharmacy`: member_id, drug_name, adherence_pct, fill_date
- `claims`: member_id, icd_code, type, amount, date, provider

## Query Patterns

```typescript
// Filter by state
where(inArray(members.state, ['TX', 'FL']))

// Filter by risk tier
where(eq(members.riskTier, 'high'))

// Join SDOH data
.leftJoin(sdoh, eq(members.id, sdoh.memberId))

// Search conditions (text match)
where(like(members.chronicConditions, '%Diabetes%'))

// Combine filters
where(and(
  inArray(members.state, states),
  eq(members.riskTier, 'high'),
  or(...conditions.map(c => like(members.chronicConditions, `%${c}%`)))
))
```

## Output Format

Always return structured JSON:
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
      "sdoh": { "transportationBarrier": true, "foodInsecurity": false, "housingInstability": false }
    }
  ]
}
```

## Validation

Run the eval script to verify query correctness:
```bash
npx tsx .agents/skills/cohort-query/eval.ts
```
