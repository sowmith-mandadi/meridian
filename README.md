# Meridian

**Codex-powered multi-agent healthcare intelligence platform.**

Built for the OpenAI Codex Hackathon. Meridian transforms raw healthcare data into actionable insights through governed AI chat, agentic data pipelines, and cross-team agent collaboration.

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

1. **Agentic Data Engineering** (`/pipeline`) — Visual DAG showing the 5-step data pipeline
2. **Governed AI Chat** (`/chat`) — Streaming chat with 6 AI tools, explainability panel
3. **Agent-to-Agent Collaboration** (`/collaborate`) — Animated A2A communication flow

## Tech Stack

- **Next.js 15** App Router on Vercel
- **Vercel AI SDK v6** with OpenAI (streaming, tool calling)
- **shadcn/ui** (new-york, dark mode, Geist fonts)
- **Turso / libSQL** (SQLite-compatible, Vercel serverless ready)
- **Drizzle ORM** (type-safe SQL)
- **NextAuth v5** (role-based credentials auth)
- **Recharts** (embedded charts in chat)
- **react-resizable-panels** (Kanna-inspired three-panel layout)

## Codex Artifacts

- `AGENTS.md` — Project context for Codex
- `.codex/config.toml` — Model and agent configuration
- `.codex/agents/` — Custom subagents (data-seeder, tool-builder, ui-composer)
- `.agents/skills/` — Reusable skills (cohort-query, explain-risk)

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
| `/login` | Role-based login with quick demo access |
| `/chat` | Governed AI chat with streaming + tool results |
| `/pipeline` | Agentic data pipeline DAG viewer |
| `/collaborate` | Agent-to-agent collaboration visualization |
| `/feedback` | Feedback request CRUD (admin) |
| `/observe` | Observability dashboard (tokens, latency, cost) |
