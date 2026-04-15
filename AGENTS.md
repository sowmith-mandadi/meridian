# Project Guidance

This repository implements a Codex-based multi-agent pipeline to clean and standardize raw healthcare data, build member-level features, and train an ML model to predict the probability of `inpatient_hospital_visit` in the next 6 months.

Objective:
- Clean and standardize healthcare source files from `data/raw`.
- Build selective member-level 3-month and 6-month lookback features.
- Train and score a logistic regression baseline for inpatient hospitalization risk.
- Produce reports, data dictionaries, and automated quality checks for generated datasets.

Agent design:
- Define repo-local agent roles in `agents/*.toml`.
- Use a supervisor agent to coordinate planning, approvals, handoffs, and final pipeline execution.
- Use specialist agents for data preparation, feature engineering, modeling, and QA.
- Prefer existing skills in `skills/` before adding new logic.

Recommended agents:
- `supervisor`: orchestrates the full workflow and enforces the specs approval gate.
- `data-prep`: profiles raw data, standardizes columns, and applies approved imputations.
- `feature-builder`: creates targets, lookback features, and preprocessing metadata.
- `model-evaluator`: trains the logistic baseline and refreshes model artifacts.
- `qa-validator`: runs deterministic data validation and pytest-based quality checks.

Skill usage:
- `supervisor` uses `inpatient-risk-pipeline` and `pytest-data-quality-suite`.
- `data-prep` uses `healthcare-data-profile-clean`, `healthcare-column-standardizer`, and `missing-value-imputer`.
- `feature-builder` uses `inpatient-target-labeler`, `member-lookback-features`, and `tabular-preprocessing`.
- `model-evaluator` uses `logistic-risk-model`.
- `qa-validator` uses `data-cleaning-tests` and `pytest-data-quality-suite`.

Data locations:
- Save cleaned and intermediate outputs to `data/staging`.
- Save approved derived datasets and model outputs to `data/processed`.

Guardrails:
- Do not create final data artifacts unless a human explicitly approves `tech_spcs.yml`.
- Keep technical implementation details in `tech_spcs.yml`.
- Prefer deterministic Python scripts for repeatable agent actions.
- Use reports, data dictionaries, and tests as part of the delivery contract.
