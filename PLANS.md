# Meridian Execution Plan Template

Use this template for multi-step tasks. Copy and fill in for each major feature.

## Plan: [Feature Name]

### Goal
One sentence describing what we're building and why.

### Context
- Which files/folders are affected
- Which tools/APIs are involved
- Any constraints or dependencies

### Steps

1. [ ] Step 1 — description
2. [ ] Step 2 — description
3. [ ] Step 3 — description

### Done when
- [ ] TypeScript compiles with no errors (`pnpm typecheck`)
- [ ] Feature is visually correct in dark mode
- [ ] Tool results render in both transcript and explain panel
- [ ] No raw PHI exposed in UI

### Risks
- List anything that could go wrong or block progress

---

## Current Plan: Hackathon MVP

### Goal
Build a fully functional healthcare intelligence demo for the OpenAI Codex Hackathon.

### Steps

1. [x] Scaffold Next.js + shadcn + Turso + Drizzle + Auth
2. [x] Define schema + seed 500 synthetic members
3. [x] Build /api/chat with 6 tools (identify_cohort, get_risk_drivers, explain_member, recommend_outreach, generate_chart, submit_feedback)
4. [x] Build three-panel chat UI with streaming + tool cards + explain panel
5. [x] Build /pipeline DAG viewer
6. [x] Build /collaborate A2A animation
7. [x] Build /feedback CRUD + /observe dashboard
8. [x] Auth with 3 roles (care_manager, analyst, admin)
9. [x] Chat persistence with localStorage
10. [x] Codex artifacts: AGENTS.md, subagents, skills, config, plans, hooks, slash commands
11. [ ] Deploy to Vercel
12. [ ] Record demo video with Kanna showing Codex usage

### Done when
- Chat streams tool results with charts and tables
- Pipeline DAG shows animated steps
- A2A view shows governed collaboration
- Deployed to .vercel.app
- Demo video recorded
