# Inpatient Hospitalization Risk Pipeline

This project cleans raw healthcare data, standardizes source tables, creates member-level lookback features, and builds a logistic regression baseline to predict the probability of an inpatient hospital visit in the next 6 months.

## Multi-Agent Design

This repository also defines a lightweight Codex multi-agent structure in `agents/*.toml`.

- `supervisor`: coordinates the full workflow and enforces the specs approval gate
- `data-prep`: profiles raw data, standardizes columns, and handles approved imputations
- `feature-builder`: creates targets, lookback features, and preprocessing metadata
- `model-evaluator`: refreshes model artifacts and risk scores
- `qa-validator`: runs deterministic validation and pytest-based quality checks

These agents are aligned to the reusable skills under `skills/`, so the repo keeps role guidance, reusable skills, and deterministic Python scripts separate.

## Project Flow

1. Review project guidance in `AGENTS.md`.
2. Generate or refresh `tech_spcs.yml`.
3. Human reviews the specs file and sets `final_data_approved: true`.
4. Run the gated pipeline to create staged data, processed outputs, model artifacts, reports, and data dictionaries.

## Setup

```bash
python -m pip install -r requirements.txt
```

## Main Command

Generate specs draft:

```bash
python scripts/run_specs_gated_pipeline.py --force-regenerate-specs
```

Run pipeline after approval:

```bash
python scripts/run_specs_gated_pipeline.py
```

## Key Files

- `data/raw/`: source CSV files
- `data/staging/`: cleaned and standardized intermediate tables
- `data/processed/final_member_dataset.csv`: final approved modeling dataset
- `data/processed/model_artifacts/`: metrics, coefficients, holdout scores, and full dataset scores
- `data/processed/reports/`: dataset-level summary reports
- `data/processed/data_dictionaries/`: column-level data dictionaries
- `agents/`: repo-local multi-agent role configs
- `skills/`: reusable skills and deterministic helper scripts
- `tech_spcs.yml`: specs and approval gate

## Risk Score

The final probability column is:

- `inpatient_hospitalization_risk_probability` in `data/processed/final_member_dataset.csv`

The model score outputs also appear in:

- `data/processed/model_artifacts/full_dataset_scores.csv`
- `data/processed/model_artifacts/holdout_scores.csv`

Each scored member now also gets top driver fields such as:

- `top_driver_1_feature`
- `top_driver_1_contribution`
- `top_driver_1_direction`

Long-form member explanation outputs are also written to:

- `data/processed/model_artifacts/member_top_drivers.csv`
- `data/processed/model_artifacts/holdout_member_top_drivers.csv`

## Notes

- The pipeline should not create final data when `final_data_approved: false`.
- `run_specs_gated_pipeline.py` updates model artifacts during approved runs.
