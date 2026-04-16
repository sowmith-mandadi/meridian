---
name: member-lookback-features
description: Create member-level 3 month and 6 month lookback features from cleaned healthcare tables. Use when Codex needs selective utilization, claims, pharmacy, call center, SDOH, or enrollment features aligned to an approved index date.
---

# Member Lookback Features

Engineer a selective member-level view, not every possible aggregation.

## Workflow

1. Start from cleaned staged tables with canonical column names.
2. Use an approved `index_date`, or inherit it from the target file.
3. Run `scripts/build_member_lookback_features.py` to produce 90-day and 180-day features.
4. Keep only features that are clinically or operationally relevant to inpatient risk.

## Feature Pattern

- Counts and spend from claims.
- Prior ER, inpatient, observation, LOS, and avoidable utilization.
- Pharmacy fill intensity and adherence summaries.
- Recent call center burden.
- Latest SDOH flags before the index date.
- Static enrollment attributes such as age, sex, diabetes flag, line of business, and plan type.

## Guardrails

- Use only information on or before the index date.
- Avoid exploding one-hot style features for every raw variable.
- Preserve feature provenance by window and source.

## Resource

- Use `scripts/build_member_lookback_features.py` for deterministic feature generation.
