"use client";

import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  Database,
  FileSearch,
  GitBranch,
  Layers,
  MessageSquare,
  Package,
  Play,
  Search,
  Shield,
  Sparkles,
  Table,
  Wrench,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import Link from "next/link";
import { AppNav } from "@/components/app-nav";

const PIPELINE_TOOLS = [
  { icon: Search, name: "inspect_sources", desc: "Discover all tables, row counts, null rates" },
  { icon: BarChart3, name: "profile_table", desc: "Distributions, outliers, data quality stats" },
  { icon: Wrench, name: "standardize_records", desc: "Fix ICD codes, normalize drugs, quarantine bad data" },
  { icon: GitBranch, name: "resolve_entities", desc: "FK integrity and fuzzy duplicate detection" },
  { icon: Shield, name: "validate_quality", desc: "9 configurable quality gates with thresholds" },
  { icon: Database, name: "save_pipeline_run", desc: "Audit trail of agent decisions and scores" },
  { icon: Table, name: "create_data_source", desc: "Create new tables from natural language" },
  { icon: Package, name: "create_data_product", desc: "Publish versioned, reusable data products" },
];

const CHAT_TOOLS = [
  { name: "identify_cohort", desc: "Filter members by state, condition, risk tier" },
  { name: "get_risk_drivers", desc: "SDOH, clinical, and pharmacy risk factors" },
  { name: "explain_member", desc: "Why a member was flagged" },
  { name: "recommend_outreach", desc: "Prioritized interventions" },
  { name: "generate_chart", desc: "Bar/pie/line from aggregates" },
  { name: "submit_feedback", desc: "Request new metrics" },
];

const STATS = [
  { value: "20+", label: "MCP Tools" },
  { value: "500", label: "Synthetic Members" },
  { value: "280", label: "Dirty Records" },
  { value: "5", label: "Data Tables" },
];

export default function CodexPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppNav />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <header className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-transparent" />
        <div className="relative mx-auto max-w-4xl px-6 py-20 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">Meridian</h1>
          </div>
          <p className="text-xl text-muted-foreground mb-3">
            From fragmented healthcare data to governed action
          </p>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Codex builds reusable, governed healthcare data products from natural language.
            Agents inspect, clean, validate, and publish — then care teams query through
            a governed chat interface. One platform, two audiences, connected by AI.
          </p>

          <div className="flex items-center justify-center gap-3 mt-8">
            <Link href="/chat">
              <Button size="lg" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Open Chat
              </Button>
            </Link>
            <Link href="/pipeline">
              <Button variant="outline" size="lg" className="gap-2">
                <Play className="h-4 w-4" />
                Pipeline
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Stats bar ────────────────────────────────────────── */}
      <section className="border-b bg-card/50">
        <div className="mx-auto max-w-4xl grid grid-cols-4 divide-x">
          {STATS.map((s) => (
            <div key={s.label} className="py-6 text-center">
              <p className="text-2xl font-bold tracking-tight">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Problem → Solution ───────────────────────────────── */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-destructive/20 bg-destructive/[0.02]">
              <CardContent className="pt-6">
                <p className="text-sm font-semibold text-destructive mb-3">The Problem</p>
                <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                  <p>
                    Healthcare organizations need to improve care management, prioritize outreach,
                    support operations, and identify members who may need early intervention. But
                    the data behind those decisions is scattered across many systems, difficult to
                    reconcile, and tightly controlled because it contains sensitive health information.
                  </p>
                  <p>
                    That creates a familiar pattern: technical teams spend huge amounts of time
                    pulling data together, cleaning it, validating it, and stitching it into
                    something usable. Then a downstream team asks for a new feature, a new
                    population, or a new slice of the data, and the cycle starts again.
                  </p>
                  <div className="rounded-lg border border-destructive/10 bg-background/60 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-destructive/80 mb-1">
                      Concrete Example
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Build a trusted member-level asset for predicting hospitalization risk over
                      the next six months, then make that output usable for downstream
                      care-management workflows.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-primary/20 bg-primary/[0.02]">
              <CardContent className="pt-6">
                <p className="text-sm font-semibold text-primary mb-3">Meridian's Solution</p>
                <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                  <p>
                    Meridian creates a reusable and governed workflow that reduces manual handoffs,
                    helps technical teams build trusted data assets faster, and makes those assets
                    safely usable by downstream teams through role-based agents.
                  </p>
                  <div className="space-y-2">
                    <div className="rounded-lg border bg-background/70 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-primary mb-1">
                        1. Build The Asset
                      </p>
                      <p>
                        Codex starts from plain-English requirements in <code className="text-foreground">AGENTS.md</code>,
                        generates a reviewable technical spec, and helps create pipeline logic,
                        validation checks, and reusable skills.
                      </p>
                    </div>
                    <div className="rounded-lg border bg-background/70 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-primary mb-1">
                        2. Operationalize It
                      </p>
                      <p>
                        The trusted asset is exposed through a governed Vercel app where admins,
                        care managers, and analysts use the same asset through different
                        permissions, tools, and workflows.
                      </p>
                    </div>
                    <div className="rounded-lg border bg-background/70 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-primary mb-1">
                        3. Improve It Continuously
                      </p>
                      <p>
                        New downstream requests become spec updates, code changes, validation
                        workflows, and reviewable outputs, so each request strengthens a reusable
                        governed asset instead of creating more one-off work.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────── */}
      <section className="px-6 py-16 border-t">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-center mb-2">How It Works</h2>
          <p className="text-sm text-muted-foreground text-center mb-12 max-w-xl mx-auto">
            Agents manage the full data lifecycle — from dirty ingestion to governed access
          </p>

          <div className="grid gap-px md:grid-cols-4 rounded-xl overflow-hidden border bg-border">
            {[
              { step: "01", icon: FileSearch, title: "Inspect", desc: "Agent inventories data sources, profiles quality, identifies issues", color: "text-blue-400" },
              { step: "02", icon: Wrench, title: "Clean", desc: "Standardize codes, normalize names, quarantine bad records", color: "text-amber-400" },
              { step: "03", icon: Shield, title: "Validate", desc: "Run quality gates, resolve entities, save audit trail", color: "text-emerald-400" },
              { step: "04", icon: Package, title: "Publish", desc: "Create versioned data products for downstream agents and users", color: "text-purple-400" },
            ].map((item) => (
              <div key={item.step} className="bg-card p-6 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-mono text-muted-foreground">{item.step}</span>
                  <item.icon className={`h-5 w-5 ${item.color}`} />
                </div>
                <p className="text-sm font-semibold mb-1">{item.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Agentic Pipeline Tools ───────────────────────────── */}
      <section className="px-6 py-16 border-t bg-card/30">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-2 mb-1">
            <Bot className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold">Agentic Pipeline</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-8">
            10 composable MCP tools — the agent decides which to run, in what order, with what parameters
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {PIPELINE_TOOLS.map((tool) => (
              <div
                key={tool.name}
                className="flex items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/30"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <tool.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-mono font-medium truncate">{tool.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{tool.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground mt-4 text-center">
            Plus <code className="text-foreground">list_data_products</code>, <code className="text-foreground">quarantine_records</code>, and the legacy <code className="text-foreground">run_pipeline</code> one-shot
          </p>
        </div>
      </section>

      {/* ── Governed Chat ────────────────────────────────────── */}
      <section className="px-6 py-16 border-t">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="h-5 w-5 text-emerald-400" />
            <h2 className="text-2xl font-bold">Governed Chat</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-8">
            Care teams query governed data products through an AI chat — no code required
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold mb-3">AI Tools</h3>
              <div className="space-y-2">
                {CHAT_TOOLS.map((tool) => (
                  <div key={tool.name} className="flex items-start gap-2">
                    <Badge variant="secondary" className="text-[10px] font-mono shrink-0 mt-0.5">
                      {tool.name}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{tool.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">Governance</h3>
              <div className="space-y-3">
                {[
                  { role: "Care Manager", access: "Full member-level access with masked identifiers" },
                  { role: "Analyst", access: "Aggregated data and charts only" },
                  { role: "Admin", access: "Everything + observability + feedback management" },
                ].map((r) => (
                  <div key={r.role} className="rounded-lg border bg-card p-3">
                    <p className="text-sm font-medium">{r.role}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{r.access}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-lg border border-primary/20 bg-primary/[0.03] p-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground">Human-in-the-loop</span> — governed
                  queries require explicit user approval. Every access is audited with role, intent,
                  and masked references.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Architecture ─────────────────────────────────────── */}
      <section className="px-6 py-16 border-t bg-card/30">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-center mb-2">Architecture</h2>
          <p className="text-sm text-muted-foreground text-center mb-10">Three layers, one platform</p>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Layers,
                title: "Agentic Data Engineering",
                desc: "Composable pipeline tools that inspect, clean, validate, and publish data products from raw sources",
                path: "/pipeline",
                badge: "10 tools",
                color: "text-amber-400",
              },
              {
                icon: MessageSquare,
                title: "Governed AI Chat",
                desc: "Streaming chat with role-based access, explainability panel, and human-in-the-loop governance",
                path: "/chat",
                badge: "6 tools",
                color: "text-emerald-400",
              },
              {
                icon: Zap,
                title: "Agent Collaboration",
                desc: "Host/client agent communication with governed cross-team data access and audit logging",
                path: "/collaborate",
                badge: "A2A",
                color: "text-purple-400",
              },
            ].map((layer) => (
              <Link key={layer.title} href={layer.path}>
                <Card className="h-full transition-all hover:border-primary/30 hover:shadow-sm cursor-pointer">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-3">
                      <layer.icon className={`h-5 w-5 ${layer.color}`} />
                      <Badge variant="outline" className="text-[10px]">{layer.badge}</Badge>
                    </div>
                    <p className="text-sm font-semibold mb-1">{layer.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{layer.desc}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Try It ───────────────────────────────────────────── */}
      <section className="px-6 py-16 border-t">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold mb-2">Try It</h2>
          <p className="text-sm text-muted-foreground mb-8 max-w-lg mx-auto">
            Run these prompts in Codex to see the agentic pipeline in action
          </p>

          <div className="space-y-3 text-left max-w-2xl mx-auto">
            {[
              "Inspect all data sources and profile the raw_claims table",
              "Standardize raw_claims with a dry run first, then commit the clean records",
              "Run quality validation, save the pipeline run, and create a data product called 'diabetes_care_gaps'",
              "As a care_manager, query high-risk members in TX through the governance flow and generate outreach plans",
            ].map((prompt, i) => (
              <div
                key={i}
                className="group flex items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/30"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-mono font-medium text-primary">
                  {i + 1}
                </span>
                <p className="text-sm text-muted-foreground leading-relaxed">{prompt}</p>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/0 group-hover:text-primary transition-colors mt-0.5 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech Stack ───────────────────────────────────────── */}
      <section className="border-t px-6 py-10">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
            Built With
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              "OpenAI Codex",
              "Next.js 15",
              "Vercel AI SDK v6",
              "shadcn/ui",
              "Turso / libSQL",
              "Drizzle ORM",
              "MCP",
              "Recharts",
            ].map((tech) => (
              <Badge key={tech} variant="outline" className="text-xs font-normal">
                {tech}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer CTA ───────────────────────────────────────── */}
      <section className="border-t bg-card/50 px-6 py-10">
        <div className="mx-auto max-w-2xl flex flex-col items-center gap-4 text-center">
          <Sparkles className="h-5 w-5 text-primary" />
          <p className="text-sm text-muted-foreground">
            From fragmented data to governed action — powered by Codex
          </p>
          <div className="flex gap-3">
            <Link href="/chat">
              <Button size="sm" className="gap-2">
                <MessageSquare className="h-3.5 w-3.5" />
                Open Chat
              </Button>
            </Link>
            <Link href="/pipeline">
              <Button variant="outline" size="sm" className="gap-2">
                <Play className="h-3.5 w-3.5" />
                Pipeline
              </Button>
            </Link>
            <Link href="/collaborate">
              <Button variant="outline" size="sm" className="gap-2">
                <Zap className="h-3.5 w-3.5" />
                Collaborate
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
