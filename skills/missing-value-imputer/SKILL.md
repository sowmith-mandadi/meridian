---
name: missing-value-imputer
description: Apply deterministic missing-value handling to cleaned healthcare tables or feature sets. Use when Codex needs repeatable imputations for numeric, categorical, or binary columns without silently changing identifier or date fields.
---

# Missing Value Imputer

Impute only after profiling and column standardization.

## Workflow

1. Run `scripts/impute_missing_values.py` on a staged table or model matrix.
2. Leave identifier and date fields untouched unless a human-approved rule says otherwise.
3. Fill binary flags with `0`, numeric features with median, and categorical values with `unknown`.
4. Save the imputed output and the imputation report together.

## Guardrails

- Do not impute member IDs.
- Do not backfill future information into lookback features.
- Prefer explicit project rules over broad heuristics when a field affects label leakage risk.

## Resource

- Use `scripts/impute_missing_values.py` for deterministic imputation and reporting.
