---
name: pipeline-runner
description: Runs the 5-step healthcare data pipeline (Ingest, Profile, Standardize, Entity Resolve, Validate) and returns real-time results. Use when building or validating data pipelines.
---

# Pipeline Runner Skill

Execute the end-to-end healthcare data pipeline.

## How to execute

Use the `meridian` MCP server tool `run_pipeline`. Do NOT read source code or write scripts.

```
MCP tool: run_pipeline
Server: meridian
Input: {} (no arguments)
```

## What it does

Runs 5 steps sequentially against the healthcare database:

1. **Ingest** — Count records per source table
2. **Profile** — Compute age/risk stats, null rates, distributions
3. **Standardize** — Validate ICD-10 codes, drug names, date ranges
4. **Entity Resolve** — Count member linkages across sources
5. **Validate** — Run quality gates (grain, referential integrity, business rules)

## Output

Array of step results plus a summary:

```json
[
  {
    "step": "ingest",
    "status": "completed",
    "durationMs": 8,
    "output": { "members": 500, "claims": 2454, "pharmacy": 1007, "sdoh": 500, "call_center": 305, "total_records": 4766 }
  },
  ...
  {
    "step": "summary",
    "status": "completed",
    "durationMs": 56,
    "output": { "pipeline": "hospitalization_risk_prediction", "stepsCompleted": 5, "stepsTotal": 5, "qualityScore": "100%", "readyForModeling": true }
  }
]
```

## Do not

- Do NOT read `src/app/api/pipeline/route.ts`
- Do NOT write or execute scripts
- ONLY use `run_pipeline` from the `meridian` MCP server
