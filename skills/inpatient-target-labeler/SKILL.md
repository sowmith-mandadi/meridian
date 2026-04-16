---
name: inpatient-target-labeler
description: Create member-level labels for inpatient hospital visits in the next 6 months. Use when Codex needs a reproducible target definition, label window, and event summary based on utilization records and enrollment coverage.
---

# Inpatient Target Labeler

Define the target cleanly before building features.

## Workflow

1. Use cleaned enrollment and utilization tables.
2. Set the label window to the last fully observed 6-month period unless a human-approved specs file says otherwise.
3. Run `scripts/create_inpatient_target.py` to build the member-level label table.
4. Keep binary target, event count, first event date, and lookforward eligibility indicators.

## Guardrails

- Use utilization events as the source of truth for inpatient visits.
- Keep the label window explicit in the output.
- Do not create alternate target variants unless a human asks for them.

## Resource

- Use `scripts/create_inpatient_target.py` for deterministic target generation.
