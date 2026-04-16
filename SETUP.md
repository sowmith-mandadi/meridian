# Meridian — Setup Guide

Pick the path that matches what you need:

| Path | Who it's for | Local install needed? |
|------|-------------|----------------------|
| **[Path A: Codex + Live App](#path-a-codex--live-app-no-local-install)** | Using Codex to explore/build, viewing the live Vercel app | No |
| **[Path B: Local Development](#path-b-local-development)** | Running the app on your machine, making code changes | Yes |

---

## Path A: Codex + Live App (No Local Install)

If you're using **OpenAI Codex** to work with the repo and the **live Vercel deployment** to view the app, you don't need to install anything locally. No Node.js, no pnpm, no `.env.local`, no database setup.

### What you get

- **Live app:** [meridian-two-drab.vercel.app](https://meridian-two-drab.vercel.app)
- **Codex** reads the repo, sees the plugin at `plugins/meridian-healthcare/`, and connects to the Vercel MCP endpoint automatically

### Steps

1. **Open the repo in Codex**

   Point Codex at this repository. It will automatically pick up:
   - `AGENTS.md` — project context and conventions
   - `.codex/config.toml` — model config and MCP server connections
   - `plugins/meridian-healthcare/` — the full plugin with 20+ MCP tools and skills

2. **MCP is already configured**

   The Codex config connects to the remote MCP server — no local server needed:

   ```toml
   [mcp_servers.meridian]
   url = "https://meridian-two-drab.vercel.app/api/mcp/mcp"
   ```

   All tool calls (cohort queries, risk analysis, pipeline runs, data products) go through the live Vercel deployment.

3. **Use the live app to view results**

   Sign in at [meridian-two-drab.vercel.app/login](https://meridian-two-drab.vercel.app/login):

   | Role | Email | Password |
   |------|-------|----------|
   | Care Manager | `care_manager@demo.com` | `demo123` |
   | Analyst | `analyst@demo.com` | `demo123` |
   | Admin | `admin@demo.com` | `demo123` |

4. **Try a prompt in Codex**

   ```
   Find high-risk diabetic members in TX and FL with transportation barriers
   ```

   Codex calls the MCP tools on the Vercel backend and returns structured results.

**That's it.** No install, no env vars, no database.

---

## Path B: Local Development

For running the app on your machine, making code changes, or working offline.

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Node.js** | v20+ | [nodejs.org](https://nodejs.org) or via nvm (see below) |
| **pnpm** | v9+ | `npm install -g pnpm` |
| **Git** | any recent | [git-scm.com](https://git-scm.com) |
| **OpenAI API key** | — | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

<details>
<summary>Installing Node.js via nvm (recommended)</summary>

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

Restart your terminal, then:

```bash
nvm install 20
nvm use 20
node -v  # should print v20.x.x
```

</details>

<details>
<summary>Installing pnpm</summary>

```bash
npm install -g pnpm
pnpm -v  # should print 9.x.x
```

</details>

### 1. Clone the Repository

```bash
git clone https://github.com/sowmith-mandadi/meridian.git
cd meridian
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# ─── OpenAI (required for AI chat features) ───
OPENAI_API_KEY=sk-...your-key-here...

# ─── Database (local SQLite — works out of the box) ───
TURSO_DATABASE_URL=file:local.db
TURSO_AUTH_TOKEN=

# ─── Auth (generate with: openssl rand -hex 32) ───
AUTH_SECRET=paste-your-random-string-here
```

> The local SQLite file is created automatically — no external database needed.

### 4. Set Up the Database

```bash
pnpm db:push    # Create tables
pnpm db:seed    # Seed 500 synthetic healthcare members
```

### 5. Start the Dev Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with a demo account:

| Role | Email | Password |
|------|-------|----------|
| Care Manager | `care_manager@demo.com` | `demo123` |
| Analyst | `analyst@demo.com` | `demo123` |
| Admin | `admin@demo.com` | `demo123` |

---

## All Commands

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start dev server on port 3000 |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm db:push` | Push Drizzle schema to database |
| `pnpm db:seed` | Seed 500 synthetic healthcare members |
| `pnpm typecheck` | TypeScript strict check |
| `pnpm lint` | ESLint |

---

## Project Structure

```
src/
├── app/
│   ├── api/chat/          # AI SDK v6 streamText + tool definitions
│   ├── api/feedback/      # Feedback CRUD
│   ├── api/usage/         # Observability data
│   ├── (app)/chat/        # Chat page
│   ├── (app)/pipeline/    # Agentic data pipeline
│   └── (app)/collaborate/ # Agent-to-agent collaboration
├── components/
│   ├── chat/              # Chat UI components
│   └── ui/                # shadcn/ui primitives
├── lib/
│   ├── schema.ts          # Drizzle ORM schema
│   ├── db.ts              # Database connection
│   └── auth.ts            # NextAuth config
plugins/
└── meridian-healthcare/   # Codex plugin (20+ MCP tools, skills)
scripts/
└── seed.ts                # Database seeder
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `pnpm: command not found` | `npm install -g pnpm` |
| Wrong Node version | `nvm install 20 && nvm use 20` |
| DB errors on `pnpm db:push` | Make sure `.env.local` exists with `TURSO_DATABASE_URL=file:local.db` |
| `OPENAI_API_KEY` errors | Set a valid key in `.env.local` with available credits |
| Port 3000 in use | `pnpm dev -- -p 3001` |

---

## Optional: Turso Cloud (Shared Remote DB)

To share a single database across the team instead of local SQLite:

1. Create a free database at [turso.tech](https://turso.tech)
2. Update `.env.local`:

```env
TURSO_DATABASE_URL=libsql://your-db-name.turso.io
TURSO_AUTH_TOKEN=eyJhb...
```

3. Push and seed:

```bash
pnpm db:push
pnpm db:seed
```
