---
name: healthcare-column-standardizer
description: Standardize healthcare source column names, IDs, and date fields into a consistent snake_case contract. Use when Codex needs to prepare `data/raw` files for member-level joins, downstream cleaning, or reusable feature pipelines.
---

# Healthcare Column Standardizer

Standardize names before joining tables.

## Workflow

1. Run `scripts/standardize_columns.py` from `data/raw` into `data/staging`.
2. Normalize to snake_case and apply source-aware renames for member IDs, names, ZIP codes, and date columns.
3. Preserve source-specific event semantics like `service_date`, `event_date`, and `fill_date`.
4. Review the generated rename manifest before downstream processing.

## Guardrails

- Keep one canonical member key: `member_id`.
- Do not collapse clinically different date columns into a single generic field.
- Drop exact duplicate rows only after renaming and date normalization.

## Resource

- Use `scripts/standardize_columns.py` for deterministic renaming and staging output.
