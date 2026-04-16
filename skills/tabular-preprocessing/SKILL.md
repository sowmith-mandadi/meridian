---
name: tabular-preprocessing
description: Build deterministic preprocessing plans for numeric and categorical model inputs. Use when Codex needs to decide scaling, encoding, column exclusions, or audit metadata for logistic regression and other tabular models.
---

# Tabular Preprocessing

Prepare model inputs deliberately.

## Workflow

1. Run `scripts/build_preprocessing_manifest.py` on the candidate feature table.
2. Separate identifier, date, target, numeric, binary, and categorical columns.
3. Standardize continuous numeric features and keep binary indicators unscaled unless the modeling plan says otherwise.
4. One-hot encode categorical columns after basic cleanup.

## Guardrails

- Exclude IDs, target columns, and future-looking fields from transformation.
- Keep preprocessing decisions reproducible and inspectable.
- Use the manifest to drive modeling code instead of hard-coding column lists repeatedly.

## Resource

- Use `scripts/build_preprocessing_manifest.py` to generate a reproducible preprocessing plan.
