---
name: inpatient-risk-pipeline
description: Coordinate the end-to-end inpatient risk workflow from profiling through cleaning, features, testing, and logistic modeling. Use when Codex needs to execute this project safely while respecting the tech specs approval gate before final processed outputs are created.
---

# Inpatient Risk Pipeline

Run the project in stages and stop at the approval gate.

## Sequence

1. Profile raw data.
2. Standardize columns into `data/staging`.
3. Impute approved missing values.
4. Build target and lookback features.
5. Validate cleaning outputs.
6. Train and evaluate the logistic baseline.
7. Create final processed data only after specs approval.

## Guardrails

- Read the approved tech specs YAML before writing final artifacts.
- Use `data/staging` for interim tables and `data/processed` only for approved derived outputs.
- Prefer the deterministic scripts from the other skills whenever possible.

## Resource

- See `references/workflow.md` for the stage order.
- Use `scripts/check_specs_gate.py` before creating final processed data.
