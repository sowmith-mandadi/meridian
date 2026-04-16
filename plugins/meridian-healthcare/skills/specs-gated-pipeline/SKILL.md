---

## name: specs-gated-pipeline
description: Run Meridian's local Python specs-gated inpatient risk pipeline from the terminal. Use when the user wants a Codex demo that generates `tech_spcs.yml`, pauses for approval, then executes the deterministic data and model stages against local CSV files.

# Specs Gated Pipeline

Use this skill for the local Python sidecar pipeline that lives in the repo root.

## When to use

- The user wants to demo the repo's Python harness in Codex
- The task is to generate or refresh `tech_spcs.yml`
- The task is to run the approved local inpatient risk pipeline from terminal
- The user wants to explain how agent roles map to deterministic Python execution

## Protocol

1. Treat `scripts/run_specs_gated_pipeline.py` as the supervisor harness.
2. Set up the local virtualenv if needed:
   `python3 -m venv .venv && .venv/bin/python -m pip install -r requirements.txt`
3. Prefer `.venv/bin/python` for commands after setup. If the virtualenv is not available yet, use `python3`.
4. Before running any Python command in this workflow, ask the user for approval and wait for a yes.
5. Generate specs first, after approval:
   `.venv/bin/python scripts/run_specs_gated_pipeline.py --force-regenerate-specs`
6. Stop and let the human review `tech_spcs.yml`.
7. Ask the user for explicit confirmation before changing the approval flag for any demo.
8. If the user confirms, flip the top-level approval flag with:
   `.venv/bin/python scripts/run_specs_gated_pipeline.py --approve-final-data`
9. Only continue after top-level `final_data_approved: true` or `yes` is present.
10. Ask again for approval before running the approved pipeline:
   `.venv/bin/python scripts/run_specs_gated_pipeline.py`
11. Ask again for approval before running Python tests such as:
   `.venv/bin/python -m pytest`
12. Explain that the harness delegates work conceptually through repo-local agent roles in `agents/*.toml`, but actual execution is deterministic Python scripts under `skills/*/scripts/`.

## Execution stages

The approved run executes these stages in order:

1. `profile_raw_data.py`
2. `standardize_columns.py`
3. `validate_staging_tables.py`
4. `create_inpatient_target.py`
5. `build_member_lookback_features.py`
6. `build_preprocessing_manifest.py`
7. `train_logistic_model.py`

Then it merges features, target labels, and scores into `data/processed/final_member_dataset.csv` and writes reports plus data dictionaries.

## Demo framing

- The Next.js app remains the product UI on `master`.
- The Python harness is a local Codex sidecar for governed data and ML demos.
- `tech_spcs.yml` is the human approval contract.
- Agent roles provide orchestration boundaries; scripts provide deterministic execution.
- Codex should never auto-run Python commands in this skill; each `.py` or `pytest` invocation needs fresh user approval.

## Do not

- Do NOT skip the approval gate
- Do NOT flip `final_data_approved` without explicit user confirmation
- Do NOT run Python scripts or tests without explicit user confirmation
- Do NOT claim this is replacing the Next.js app
- Do NOT write final processed data before approval
- Do NOT use ad hoc notebook logic when the repo already has deterministic scripts
