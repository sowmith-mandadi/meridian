# Meridian

## Project

Healthcare intelligence platform. Next.js 15 App Router, Vercel AI SDK v6,
shadcn/ui (new-york, dark), Turso (libSQL), Drizzle ORM.

## Run

pnpm dev — starts Next.js dev server on port 3000
pnpm db:seed — seeds Turso with synthetic healthcare data
pnpm db:push — pushes Drizzle schema to Turso

## Test

pnpm typecheck && pnpm lint

## Conventions

- AI SDK v6 only: useChat with transport, streamText, message.parts
- Tools use inputSchema (not parameters)
- All API routes in app/api/
- Components in components/, shadcn primitives in components/ui/
- Dark mode by default
- Use Geist Sans for interface text, Geist Mono for code/metrics
- shadcn new-york style, zinc base color