# Components

## Structure

- `ui/` — shadcn/ui primitives. Owned by shadcn CLI. Extend via cva variants, do not rewrite.
- `chat/` — Chat-specific components: sidebar, transcript, input, tool renderers, explain panel.

## Conventions

- All chat components are client components (`"use client"`)
- Use `message.parts` for rendering (never `message.content`)
- Tool results render via `ToolResultRenderer` — add a case for each new tool
- Charts use Recharts with `ResponsiveContainer` wrapping
- Icons from `lucide-react` at `h-4 w-4` (or `h-3.5 w-3.5` for compact)
- Use shadcn tokens: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`
- Never use arbitrary hex colors — always use CSS variables or theme tokens

## Layout

Three-panel Kanna-inspired layout using `react-resizable-panels`:
- Left: sidebar (navigation + chat history + suggested prompts)
- Center: chat transcript with streaming + tool cards
- Right: explainability panel (drivers, member cards, outreach)

## Do not

- Do not import `@/lib/db` or `@/lib/auth` — these are server-only
- Do not use `isLoading` from useChat — use `status === "streaming"`
- Do not use `handleSubmit` — use `sendMessage({ text })`
- Do not nest Cards inside Cards inside Cards
