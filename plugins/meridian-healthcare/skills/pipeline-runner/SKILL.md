---
name: pipeline-runner
description: Runs the 5-step healthcare data pipeline (Ingest, Profile, Standardize, Entity Resolve, Validate) against the Turso database and returns real-time results. Use when building or validating data pipelines.
---

# Pipeline Runner Skill

Execute the end-to-end healthcare data pipeline and report results per step.

## Steps

1. **Ingest** — Count records per source table (members, claims, pharmacy, SDOH, call_center)
2. **Profile** — Compute column-level stats: min/max/avg age, null rates, risk score distribution
3. **Standardize** — Validate ICD-10 codes, drug names, date ranges across all records
4. **Entity Resolve** — Count member linkages across source tables, identify orphan records
5. **Validate** — Run quality gates: grain check, referential integrity, business rules

## API

`POST /api/pipeline` — streams NDJSON (one JSON object per line).

## Output per step

```json
{
  "step": "ingest",
  "status": "completed",
  "durationMs": 8,
  "output": {
    "members": 500,
    "claims": 2454,
    "pharmacy": 1007,
    "sdoh": 500,
    "call_center": 305,
    "total_records": 4713
  }
}
```

## Final Summary

Last line of the stream is always the summary:

```json
{
  "step": "summary",
  "status": "completed",
  "durationMs": 13,
  "output": {
    "pipeline": "hospitalization_risk_prediction",
    "stepsCompleted": 5,
    "stepsTotal": 5,
    "totalDurationMs": 13,
    "qualityScore": "100%",
    "readyForModeling": true
  }
}
```

## Conventions

- All fields use camelCase (matching the project's TypeScript/Drizzle conventions)
- Step names: `ingest`, `profile`, `standardize`, `entity_resolve`, `validate`, `summary`
- Status values: `completed`, `failed`
