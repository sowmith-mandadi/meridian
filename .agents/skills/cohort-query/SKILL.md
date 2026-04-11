---
name: cohort-query
description: Generates SQL queries to identify healthcare member cohorts from Meridian's Turso database. Use when filtering members by state, condition, risk tier, or SDOH indicators.
---

# Cohort Query Skill

Generate Drizzle ORM queries against Meridian's schema to find member cohorts.

## Schema
- members: id, name, state, age, gender, risk_score, risk_tier, chronic_conditions
- sdoh: member_id, transportation_flag, food_insecurity, housing_instability
- pharmacy: member_id, drug_name, adherence_pct
- claims: member_id, icd_code, type, amount, date

## Patterns
- Filter by state: `where(inArray(members.state, ['TX', 'FL']))`
- Filter by risk: `where(eq(members.riskTier, 'high'))`
- Join SDOH: `leftJoin(sdoh, eq(members.id, sdoh.memberId))`
- Condition search: `where(like(members.chronicConditions, '%Diabetes%'))`
