---
name: pytest-data-quality-suite
description: Run and extend the pytest suite for healthcare data quality, cleaning rules, and specs gating. Use when Codex needs to validate column standardization, imputation, staging table contracts, or approval-gate behavior with repeatable automated tests.
---

# Pytest Data Quality Suite

Use automated tests to protect the cleaning and gating contract.

## Workflow

1. Add or update tests under `tests/`.
2. Keep fixtures synthetic and deterministic.
3. Prefer direct function tests for transformations and subprocess tests for CLI validators.
4. Run `scripts/run_pytest_suite.py` to execute the suite consistently.

## Guardrails

- Test behavior that matters to data trust, not only happy-path execution.
- Cover approval-gate bugs and date parsing edge cases.
- Keep tests fast and independent from production data files.

## Resource

- Use `scripts/run_pytest_suite.py` as the deterministic test runner.
