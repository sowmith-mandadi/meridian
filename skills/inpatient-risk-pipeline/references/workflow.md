# Workflow

Use the inpatient risk pipeline in this order:

1. Profile `data/raw`.
2. Standardize columns into `data/staging`.
3. Apply approved imputations only where needed.
4. Create the target label from utilization and enrollment.
5. Build member-level 3 month and 6 month lookback features.
6. Validate staging outputs with deterministic checks.
7. Fit and score the logistic regression baseline.
8. Stop before creating final processed artifacts unless the approved tech specs YAML explicitly allows it.
