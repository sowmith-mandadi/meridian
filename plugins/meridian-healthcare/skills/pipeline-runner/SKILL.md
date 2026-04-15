---

## name: pipeline-runner
description: Agentic data pipeline management — inspect, profile, clean, resolve, validate, and publish healthcare data products using composable MCP tools. Use when building, debugging, or managing data pipelines.

# Agentic Pipeline Runner Skill

Build and manage healthcare data pipelines through composable MCP tools. The agent decides which steps to run, in what order, and with what parameters.

## Available Tools

All tools are on the `meridian` MCP server.

| Tool | Purpose | Writes? |
|------|---------|---------|
| `inspect_sources` | Inventory all tables, row counts, null rates, freshness | No |
| `profile_table` | Deep-dive stats: distributions, nulls, outliers for one table | No |
| `standardize_records` | Fix ICD codes, normalize drugs, quarantine bad records | Yes (unless dryRun=true) |
| `resolve_entities` | Check FK integrity (exact) or find duplicate members (fuzzy) | No |
| `quarantine_records` | Move specific bad records to quarantine staging | Yes |
| `validate_quality` | Run configurable quality gates with custom thresholds | No |
| `save_pipeline_run` | Record pipeline decisions and quality score as audit trail | Yes |
| `create_data_source` | Create a new table from natural language description | Yes |
| `create_data_product` | Save a named, versioned data product to the catalog | Yes |
| `list_data_products` | List all published data products | No |
| `run_pipeline` | Legacy one-shot 5-step pipeline (kept for quick demos) | No |

## Recommended Protocol

The agent should follow this sequence, adapting based on findings:

```
1. inspect_sources          — See what data exists and its quality
2. profile_table (raw_*)    — Deep-dive into dirty raw data
3. standardize_records      — dryRun=true first, then commit
4. resolve_entities         — exact first, fuzzy if needed
5. quarantine_records       — Move remaining bad records
6. validate_quality         — Run quality gates
7. save_pipeline_run        — Record audit trail
8. create_data_product      — Publish reusable product
```

The agent MUST NOT skip the dry run step. Always preview before writing.

## Example Prompts

- "Inspect all data sources and profile the raw claims table"
- "Clean and standardize raw_claims — do a dry run first, then commit"
- "Run the full agentic pipeline and create a diabetes care gaps data product"
- "Create a new data source for social determinants screening results"
- "What data products exist? List them all."

## Key Data

- `raw_claims` — 200 dirty records with ICD typos, orphan member IDs, future dates, negative amounts
- `raw_pharmacy` — 80 dirty records with mangled drug names, out-of-range adherence, missing dates
- `members`, `claims`, `pharmacy`, `sdoh`, `call_center`, `utilization` — Clean reference tables

## Do not

- Do NOT read source code files — use the MCP tools
- Do NOT write SQL manually — the tools handle all queries
- Do NOT skip the dry run when standardizing records
- Do NOT create data products without running validation first
