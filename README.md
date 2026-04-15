# Meridian

**Codex-powered multi-agent healthcare intelligence platform.**

Built for the OpenAI Codex Hackathon. Meridian transforms raw healthcare data into actionable insights through governed AI chat, agentic data pipelines, and cross-team agent collaboration.

## Demo

https://github.com/user-attachments/assets/demo.mov

[Watch the demo video](demo.mov) — Agentic pipeline in Codex: inspect dirty data, profile quality issues, clean records, validate, and publish a reusable data product.

**Live app:** [meridian-two-drab.vercel.app](https://meridian-two-drab.vercel.app)

## Quick Start

```bash
# Install dependencies
pnpm install

# Push database schema (local SQLite)
pnpm db:push

# Seed with 500 synthetic healthcare members
pnpm db:seed

# Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with any demo account:

| Role | Email | Password |
|------|-------|----------|
| Care Manager | care_manager@demo.com | demo123 |
| Analyst | analyst@demo.com | demo123 |
| Admin | admin@demo.com | demo123 |

## Architecture

Three layers:

1. **Agentic Data Engineering** (`/pipeline`) — 10 composable MCP tools: inspect, profile, standardize, resolve entities, quarantine, validate, save runs, create data sources, create and list data products
2. **Governed AI Chat** (`/chat`) — Streaming chat with 6 AI tools, explainability panel, role-based field masking
3. **Agent-to-Agent Collaboration** (`/collaborate`) — Governed A2A request flow with 8 shared queries across 4 roles

## Tech Stack

- **Next.js 15** App Router on Vercel
- **Vercel AI SDK v6** with OpenAI (streaming, tool calling)
- **shadcn/ui** (new-york, dark mode, Geist fonts)
- **Turso / libSQL** (SQLite-compatible, Vercel serverless ready)
- **Drizzle ORM** (type-safe SQL)
- **NextAuth v5** (role-based credentials auth)
- **Recharts** (embedded charts in chat)
- **react-resizable-panels** (Kanna-inspired three-panel layout)

## Codex Plugin

The `meridian-healthcare` plugin ships 20+ MCP tools via Streamable HTTP:

| Category | Tools |
|----------|-------|
| Pipeline | `inspect_sources`, `profile_table`, `standardize_records`, `resolve_entities`, `quarantine_records`, `validate_quality`, `save_pipeline_run` |
| Data Products | `create_data_source`, `create_data_product`, `list_data_products` |
| Chat | `identify_cohort`, `get_risk_drivers`, `explain_member`, `recommend_outreach`, `generate_chart`, `submit_feedback` |
| Governance | `check_governance`, `request_governed_access`, `governed_member_detail` |

**Install:** Add the plugin from `plugins/meridian-healthcare/` or point to the remote MCP endpoint at `https://meridian-two-drab.vercel.app/api/mcp/mcp`.

## Codex Artifacts

- `AGENTS.md` — Project context for Codex
- `.codex/config.toml` — Model and agent configuration
- `.codex/agents/` — Custom subagents (data-seeder, tool-builder, ui-composer)
- `.agents/skills/` — Reusable skills (cohort-query, explain-risk, pipeline-runner, governed-access)

## Deploy to Vercel

1. Create a [Turso](https://turso.tech) database
2. Set environment variables in Vercel:
   - `OPENAI_API_KEY`
   - `TURSO_DATABASE_URL` (libsql://...)
   - `TURSO_AUTH_TOKEN`
   - `AUTH_SECRET`
3. Deploy: `vercel --prod`
4. Run seed remotely: `TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... pnpm db:push && pnpm db:seed`

## Pages

| Route | Description |
|-------|-------------|
| `/codex` | Landing page — problem, solution, architecture, demo prompts |
| `/chat` | Governed AI chat with streaming + tool results |
| `/pipeline` | Agentic data pipeline DAG viewer |
| `/collaborate` | Agent-to-agent collaboration with shared queries across roles |
| `/feedback` | Feedback requests with detail popup |
| `/observe` | Observability dashboard (tokens, latency, cost) |
| `/login` | Role-based login with quick demo access |
