# Meridian Code Review Checklist

Use this checklist when reviewing PRs or running `/review`.

## Priority 1: Data Safety

- [ ] No raw PHI (member names, IDs, health data) exposed in client-visible aggregations
- [ ] All member data in UI uses synthetic IDs or is explicitly marked demo/synthetic
- [ ] SDOH data described with dignified language
- [ ] No unfiltered database dumps reaching the frontend

## Priority 2: AI SDK v6 Correctness

- [ ] Tools use `inputSchema` (not `parameters`)
- [ ] Chat uses `message.parts` (not `message.content`)
- [ ] Status check uses `status === "streaming"` (not `isLoading`)
- [ ] Send uses `sendMessage({ text })` (not `handleSubmit`)
- [ ] Response uses `toUIMessageStreamResponse()` (not `toDataStreamResponse()`)
- [ ] Zod schemas imported from `"zod"` (not `"zod/v4"`)

## Priority 3: Server/Client Boundary

- [ ] `@/lib/db` and `@/lib/auth` never imported in `"use client"` files
- [ ] Middleware does not import heavy server modules (native bindings)
- [ ] API routes handle errors and return proper status codes
- [ ] `server-only` import present in server modules

## Priority 4: UI Quality

- [ ] Dark mode renders correctly (no hardcoded light colors)
- [ ] All text uses theme tokens (`text-foreground`, `text-muted-foreground`)
- [ ] Charts use `ResponsiveContainer` with 100% width/height
- [ ] Tool results render in both transcript and explain panel
- [ ] Panels respect min/max size constraints

## Priority 5: Type Safety

- [ ] No unnecessary `any` types
- [ ] Tool execute functions return typed objects
- [ ] Zod schemas match expected tool inputs
- [ ] API request bodies are validated before use

## Priority 6: Performance

- [ ] No `useEffect` for data fetching in components (use API routes)
- [ ] Large lists use virtual scrolling or pagination
- [ ] Images are optimized (next/image)
- [ ] No console.log in production code
