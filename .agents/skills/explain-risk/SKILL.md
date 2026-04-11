---
name: explain-risk
description: Generates plain-language explanations of why a healthcare member was flagged as high-risk. Use when creating member-level risk narratives.
---

# Explain Risk Skill

Generate human-readable explanations for member risk flags.

## Inputs
- Member record with risk_score, chronic_conditions, age, state
- SDOH data (transportation, food, housing flags)
- Pharmacy adherence data
- Recent claims data

## Output Format
A narrative paragraph explaining:
1. Primary risk drivers (conditions + SDOH)
2. Supporting evidence (low adherence, high claims)
3. Recommended interventions
