---
name: data-cleaning-tests
description: Validate cleaned healthcare tables against a deterministic data contract. Use when Codex needs repeatable checks for canonical column names, parseable dates, duplicates, or required member-level keys after cleaning.
---

# Data Cleaning Tests

Test the cleaning contract, not just the code path.

## Workflow

1. Run `scripts/validate_staging_tables.py` on `data/staging`.
2. Check canonical column names, required keys, parseable dates, and duplicate rows.
3. Use the script output to drive unit tests or CI assertions.
4. Add explicit pytest coverage when the implementation is approved.

## Guardrails

- Fail loudly on missing `member_id` or broken date parsing.
- Keep tests deterministic and table-specific.
- Separate cleaning validation from model evaluation.

## Resource

- Use `scripts/validate_staging_tables.py` as the deterministic contract checker.
