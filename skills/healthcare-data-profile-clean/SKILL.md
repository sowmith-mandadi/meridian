---
name: healthcare-data-profile-clean
description: Profile raw or staged healthcare CSV files, summarize schema and data quality issues, and guide deterministic cleaning. Use when Codex needs to inspect missingness, duplicate rows, key coverage, date parseability, or source-level anomalies before standardization or feature engineering.
---

# Healthcare Data Profile Clean

Profile first. Quantify before changing data.

## Workflow

1. Run `scripts/profile_raw_data.py` on `data/raw` or `data/staging`.
2. Review row counts, duplicate counts, missingness, candidate member keys, and parseable date fields.
3. Use findings to decide cleaning rules instead of normalizing every column blindly.
4. Save profiling outputs alongside the stage being assessed.

## Guardrails

- Treat profiling as read-only.
- Flag inconsistent member identifiers and date fields before joining tables.
- Prefer source-specific fixes over global heuristics when a field has business meaning.

## Resource

- Use `scripts/profile_raw_data.py` for deterministic profiling summaries.
