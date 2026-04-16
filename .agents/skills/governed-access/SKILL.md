---
name: governed-access
description: Demonstrates governed agent-to-agent data access with human-in-the-loop approval. Use when a Codex agent needs healthcare data and must go through the governance gate with user confirmation.
---

# Governed Access Skill

Execute healthcare data queries through the full governance lifecycle with user input at every decision point. Use the `meridian` MCP server tools.

## Protocol

1. **Ask the user to choose a role**: care_manager, analyst, quality, or admin
2. **Call `check_governance`** with the chosen role and intent — present the governance preview
3. **Ask the user to confirm** — show blocked fields, policy note, audit warning
4. **Call `request_governed_access`** with `userConfirmed: true` only after confirmation
5. **Present results** with governance metadata: role, blocked fields, audit ID

## MCP tools used

| Tool | Purpose |
|------|---------|
| `check_governance` | Preview governance rules before executing |
| `request_governed_access` | Full governed flow with user confirmation gate |

Server: `meridian`

## Do not

- Do NOT skip governance steps
- Do NOT execute without user confirmation
- Do NOT read source files or write scripts
