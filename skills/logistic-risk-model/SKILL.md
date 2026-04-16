---
name: logistic-risk-model
description: Train and evaluate a logistic regression model for inpatient visit risk using approved member-level features. Use when Codex needs reproducible scoring, coefficients, and core validation metrics for this prediction problem.
---

# Logistic Risk Model

Use a simple, inspectable baseline first.

## Workflow

1. Merge approved features and target labels by `member_id`.
2. Exclude target leakage, IDs, and future-looking columns.
3. Run `scripts/train_logistic_model.py`.
4. Save metrics, coefficients, and scored holdout predictions.

## Metrics

- `roc_auc`
- `average_precision`
- `accuracy`
- `brier_score`
- class balance on the holdout set

## Guardrails

- Keep preprocessing deterministic and driven by the feature table.
- Do not score on columns derived from the lookforward window.
- Treat logistic regression as the baseline, not the only possible model.

## Resource

- Use `scripts/train_logistic_model.py` for repeatable training and scoring.
