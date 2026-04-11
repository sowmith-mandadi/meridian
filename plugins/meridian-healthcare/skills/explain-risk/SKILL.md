---
name: explain-risk
description: Generates plain-language explanations of why a healthcare member was flagged as high-risk. Use when creating member-level risk narratives or outreach justifications.
---

# Explain Risk Skill

Generate human-readable, clinically appropriate explanations for member risk flags.

## Inputs

- Member record: id, name, age, gender, state, risk_score, risk_tier, chronic_conditions
- SDOH data: transportation_flag, food_insecurity, housing_instability
- Pharmacy data: drug_name, adherence_pct, fill_date
- Claims data: icd_code, type, amount, date, provider

## Explanation Structure

The output must have these sections:

```json
{
  "sections": {
    "overview": { "title": "Overview", "summary": "One-paragraph plain-language summary" },
    "demographics": { "title": "Demographics", "id": "...", "name": "...", ... },
    "clinical": { "title": "Clinical profile", "chronicConditions": "...", "riskScore": 0.82 },
    "sdoh": { "title": "Social determinants", "transportationBarrier": true, ... },
    "pharmacy": { "title": "Pharmacy", "fills": [...] },
    "claims": { "title": "Recent claims", "claimCount": 12, "totalAmount": 15420, ... }
  }
}
```

## Governance Rules

- Never fabricate clinical data — only use what's in the database
- Never expose raw member names in aggregated views
- Always include a disclaimer that human review is recommended for clinical decisions
- SDOH flags should be described sensitively (e.g., "transportation access challenge" not "can't afford a car")

## Validation

```bash
npx tsx .agents/skills/explain-risk/eval.ts
```
