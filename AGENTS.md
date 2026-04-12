# Meridian

## Project

Codex-powered multi-agent healthcare intelligence platform.
Next.js 15 App Router, Vercel AI SDK v6, shadcn/ui (new-york, dark),
Turso (libSQL), Drizzle ORM, Recharts, react-resizable-panels.

## Architecture

Three-layer system:

1. **Agentic Data Engineering** (`/pipeline`) — LangGraph-style DAG: Ingest → Profile → Standardize → Entity Resolve → Validate
2. **Governed AI Chat** (`/chat`) — Streaming chat with 6 tools, explainability panel, role-based access
3. **Agent-to-Agent Collaboration** (`/collaborate`) — Host/client agent communication with governance

### Key directories

- `src/app/api/chat/` — AI SDK v6 streamText + 6 tool definitions
- `src/app/api/feedback/` — Feedback CRUD
- `src/app/api/usage/` — Observability data
- `src/components/chat/` — Chat UI: transcript, sidebar, explain panel, tool renderers
- `src/components/ui/` — shadcn/ui primitives (do not edit directly unless extending variants)
- `src/lib/` — DB connection, schema, auth, chat persistence
- `scripts/` — Seed scripts for synthetic data
- `.codex/agents/` — Custom subagents for Codex workflows
- `.agents/skills/` — Reusable skills for cohort queries, risk explanation, etc.

## Run

```bash
pnpm dev          # Next.js dev server on port 3000
pnpm db:push      # Push Drizzle schema to Turso
pnpm db:seed      # Seed 500 synthetic healthcare members
pnpm build        # Production build
```

## Test

```bash
pnpm typecheck    # TypeScript strict check
pnpm lint         # ESLint
```

## Conventions

- **AI SDK v6 only**: useChat with transport, streamText, message.parts, tool with inputSchema
- **Never use deprecated APIs**: no parameters (use inputSchema), no handleSubmit (use sendMessage), no message.content (use message.parts), no isLoading (use status)
- All API routes in `src/app/api/`
- Components in `src/components/`, shadcn primitives in `src/components/ui/`
- Dark mode by default, Geist Sans for interface, Geist Mono for code/metrics
- shadcn new-york style, zinc base color
- Use Drizzle ORM for all DB queries — never raw SQL strings
- Every tool must return structured JSON the UI can render

## Do not

- Do not expose raw PHI in any UI component — always aggregate or use synthetic IDs
- Do not import from `@/lib/db` or `@/lib/auth` in client components — server-only
- Do not use `useEffect` for data fetching — use server components or API routes
- Do not add new shadcn components without `npx shadcn@latest add`
- Do not hardcode model names — use config or environment variables
- Do not commit `.env.local` or any file containing API keys

## Review expectations

See [code_review.md](code_review.md) for the full checklist. Key points:

- Every tool must have inputSchema validation with zod
- Every API route must handle errors and return proper status codes
- Chart data must be structured as `{name, value}[]` for Recharts
- All tool results must render in both the chat transcript and the explain panel

## Planning

For complex multi-step tasks, use Plan mode (`/plan` or Shift+Tab).
See [PLANS.md](PLANS.md) for the execution plan template.