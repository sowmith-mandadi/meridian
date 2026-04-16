# API Routes

## Conventions

- All routes use Next.js App Router route handlers (export async function GET/POST)
- AI chat route uses Vercel AI SDK v6: `streamText`, `tool`, `inputSchema`, `toUIMessageStreamResponse()`
- Database access via `@/lib/db` (Drizzle ORM + Turso)
- Schema imports from `@/lib/schema`
- Never import `db` or `auth` in client components — these modules are server-only
- All tool `execute` functions must return structured JSON, not raw strings
- Error responses: `{ error: string }` with appropriate HTTP status

## Tools pattern

```typescript
import { streamText, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

tool({
  description: "...",
  inputSchema: z.object({ ... }),
  execute: async ({ ... }) => { /* query DB, return structured JSON */ },
})
```

## Do not

- Do not use `parameters` — always use `inputSchema`
- Do not use `generateObject` or `streamObject` — use `streamText` with `Output.object()` if needed
- Do not return HTML from tools — return data, let the UI render it
- Do not use `toDataStreamResponse()` — use `toUIMessageStreamResponse()`
