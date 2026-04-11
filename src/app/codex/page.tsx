"use client";

import {
  Activity,
  ArrowRight,
  Bot,
  BrainCircuit,
  Code2,
  Database,
  FileCode2,
  GitBranch,
  Layers,
  MessageSquare,
  Plug,
  Shield,
  Sparkles,
  Terminal,
  Users,
  Wrench,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

const SUBAGENTS = [
  {
    name: "data_seeder",
    nicknames: ["Nightingale", "Curie", "Semmelweis"],
    model: "gpt-5.4",
    sandbox: "workspace-write",
    description:
      "Generates realistic synthetic healthcare data — members, claims, pharmacy, SDOH — with proper ICD-10 codes and correlated risk distributions.",
  },
  {
    name: "tool_builder",
    nicknames: ["Forge", "Anvil", "Crucible"],
    model: "gpt-5.4",
    sandbox: "read-only",
    description:
      "Creates AI SDK v6 tool definitions from natural language specs. Outputs production-ready Drizzle queries with zod schemas.",
  },
  {
    name: "ui_composer",
    nicknames: ["Canvas", "Palette", "Blueprint"],
    model: "gpt-5.4",
    sandbox: "workspace-write",
    description:
      "Builds shadcn/ui page layouts from wireframe descriptions. Dark mode, Recharts, resizable panels.",
  },
  {
    name: "reviewer",
    nicknames: ["Sentinel", "Guardian", "Warden"],
    model: "gpt-5.4",
    sandbox: "read-only",
    description:
      "Reviews code for PHI safety, AI SDK correctness, server/client boundary, type safety, and accessibility.",
  },
  {
    name: "codebase_explorer",
    nicknames: ["Scout", "Pathfinder", "Ranger"],
    model: "gpt-5.3-codex-spark",
    sandbox: "read-only",
    description:
      "Read-only explorer for tracing data flows, component relationships, and schema dependencies.",
  },
];

const SKILLS = [
  {
    name: "cohort-query",
    description:
      "Generates Drizzle ORM queries to identify member cohorts by state, condition, risk tier, and SDOH indicators.",
    hasEval: true,
  },
  {
    name: "explain-risk",
    description:
      "Produces plain-language explanations of why a member is flagged as high-risk using clinical, SDOH, and pharmacy data.",
    hasEval: true,
  },
  {
    name: "outreach-plan",
    description:
      "Creates prioritized outreach recommendations mapping risk drivers to specific interventions.",
    hasEval: false,
  },
  {
    name: "chart-builder",
    description:
      "Builds Recharts-compatible data aggregates from Drizzle/SQL for bar, pie, and line visualizations.",
    hasEval: false,
  },
  {
    name: "pipeline-runner",
    description:
      "Executes the 5-step data pipeline (Ingest → Profile → Standardize → Entity Resolve → Validate) with real DB queries.",
    hasEval: false,
  },
];

const FLOW_STEPS = [
  {
    icon: Terminal,
    label: "Developer",
    sublabel: "Codex + Plugin",
    color: "text-blue-400",
  },
  {
    icon: GitBranch,
    label: "Pipeline",
    sublabel: "5 agentic steps",
    color: "text-amber-400",
  },
  {
    icon: BrainCircuit,
    label: "ML Model",
    sublabel: "Risk prediction",
    color: "text-purple-400",
  },
  {
    icon: MessageSquare,
    label: "Chat App",
    sublabel: "Governed access",
    color: "text-emerald-400",
  },
  {
    icon: Users,
    label: "End User",
    sublabel: "Care manager",
    color: "text-rose-400",
  },
];

export default function CodexPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="border-b px-6 py-10 text-center">
        <div className="mx-auto max-w-3xl space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Activity className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Meridian</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            From Code to Care — a Codex-powered healthcare intelligence platform
          </p>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
            Developers use Codex to build data pipelines and ML models.
            Care teams use the chat app to query results.
            One platform, two audiences, connected by governed AI.
          </p>
        </div>
      </header>

      {/* End-to-end flow */}
      <section className="px-6 py-10 border-b">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground text-center mb-8">
            End-to-End Flow
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-0">
            {FLOW_STEPS.map((step, i) => (
              <div key={step.label} className="flex items-center">
                <div className="flex flex-col items-center gap-2 px-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl border bg-card">
                    <step.icon className={`h-6 w-6 ${step.color}`} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">{step.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {step.sublabel}
                    </p>
                  </div>
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground mx-1 hidden md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Two-sided platform */}
      <section className="px-6 py-10">
        <div className="mx-auto max-w-6xl grid gap-8 lg:grid-cols-2">
          {/* Developer side */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Code2 className="h-5 w-5 text-blue-400" />
              <h2 className="text-xl font-semibold">For Developers</h2>
              <Badge variant="secondary" className="text-[10px]">
                Codex Plugin
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Data engineers and ML teams use the Meridian Codex plugin to build
              pipelines, generate training data, and deploy models — all through
              natural language with Codex.
            </p>

            {/* Plugin card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Plug className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">
                    meridian-healthcare
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] ml-auto">
                    v1.0.0
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Population health skills for cohort analysis, risk prediction,
                  and governed data access
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                <p>
                  <span className="text-foreground font-medium">5 skills</span>{" "}
                  · 2 MCP servers · Data & Analytics
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {["healthcare", "population-health", "risk-analysis", "sdoh", "drizzle"].map(
                    (kw) => (
                      <Badge
                        key={kw}
                        variant="secondary"
                        className="text-[9px]"
                      >
                        {kw}
                      </Badge>
                    )
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Subagents */}
            <div>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Custom Subagents ({SUBAGENTS.length})
              </h3>
              <div className="space-y-2">
                {SUBAGENTS.map((agent) => (
                  <ExpandableCard
                    key={agent.name}
                    title={agent.name}
                    badge={agent.model}
                    subtitle={agent.nicknames.join(" / ")}
                    description={agent.description}
                    extra={`Sandbox: ${agent.sandbox}`}
                  />
                ))}
              </div>
            </div>

            {/* Skills */}
            <div>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Bundled Skills ({SKILLS.length})
              </h3>
              <div className="space-y-2">
                {SKILLS.map((skill) => (
                  <ExpandableCard
                    key={skill.name}
                    title={skill.name}
                    badge={skill.hasEval ? "has eval" : undefined}
                    description={skill.description}
                  />
                ))}
              </div>
            </div>

            {/* MCP */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  MCP Servers
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">turso_healthcare_db</p>
                    <p className="text-muted-foreground">
                      Healthcare database: members, claims, pharmacy, SDOH
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[9px]">
                    libSQL
                  </Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">openaiDeveloperDocs</p>
                    <p className="text-muted-foreground">
                      AI SDK and Codex documentation
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[9px]">
                    HTTP
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* End user side */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-emerald-400" />
              <h2 className="text-xl font-semibold">For End Users</h2>
              <Badge variant="secondary" className="text-[10px]">
                Chat App
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Care managers and analysts use the governed chat interface to query
              population health data, understand risk drivers, and plan outreach
              — no code required.
            </p>

            {/* Chat capabilities */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  6 AI Tools
                </CardTitle>
                <CardDescription className="text-xs">
                  Each tool queries real data and returns structured results
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  {
                    name: "identify_cohort",
                    desc: "Filter members by state, condition, risk tier",
                  },
                  {
                    name: "get_risk_drivers",
                    desc: "Analyze SDOH, clinical, and pharmacy risk factors",
                  },
                  {
                    name: "explain_member",
                    desc: "Structured explanation of why a member is flagged",
                  },
                  {
                    name: "recommend_outreach",
                    desc: "Prioritized interventions based on risk drivers",
                  },
                  {
                    name: "generate_chart",
                    desc: "Bar/pie charts from population health aggregates",
                  },
                  {
                    name: "submit_feedback",
                    desc: "Request new metrics or features for the pipeline",
                  },
                ].map((tool) => (
                  <div
                    key={tool.name}
                    className="flex items-start gap-2 text-xs"
                  >
                    <Badge
                      variant="secondary"
                      className="text-[9px] font-mono shrink-0 mt-0.5"
                    >
                      {tool.name}
                    </Badge>
                    <span className="text-muted-foreground">{tool.desc}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Roles */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Role-Based Access
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  {
                    role: "Care Manager",
                    email: "care_manager@demo.com",
                    access:
                      "Full chat + cohort identification + outreach recommendations + explainability",
                  },
                  {
                    role: "Analyst",
                    email: "analyst@demo.com",
                    access:
                      "Aggregated data + charts + population-level queries (no individual member details)",
                  },
                  {
                    role: "Admin",
                    email: "admin@demo.com",
                    access:
                      "Everything + feedback management + observability dashboard",
                  },
                ].map((r) => (
                  <div key={r.role} className="text-xs space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.role}</span>
                      <span className="text-muted-foreground font-mono text-[10px]">
                        {r.email}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{r.access}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Sample queries */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Example Queries
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  "Find high-risk diabetic members in TX and FL where transportation is a barrier",
                  "Show risk drivers for member M-1042",
                  "Recommend outreach for members with medication non-adherence",
                  "Generate a chart of claims by type",
                ].map((q, i) => (
                  <div
                    key={i}
                    className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
                  >
                    &ldquo;{q}&rdquo;
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Governance */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-400" />
                  Governance
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1.5">
                <p>No raw PHI exposed — all data is synthetic or aggregated</p>
                <p>Tool results are structured JSON, not free-text hallucinations</p>
                <p>Explainability panel shows why each member was flagged</p>
                <p>Feedback loop lets users request new metrics without code</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Connection: how they link */}
      <section className="border-t px-6 py-10 bg-muted/20">
        <div className="mx-auto max-w-4xl text-center space-y-6">
          <h2 className="text-xl font-semibold">The Continuous Loop</h2>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
            Developers build with Codex. The pipeline produces validated,
            ML-ready data. The chat app makes it accessible. User feedback
            drives the next iteration.
          </p>
          <div className="grid gap-4 md:grid-cols-4 text-left">
            {[
              {
                icon: Code2,
                title: "Build",
                desc: "Codex + plugin generates pipeline code, tool definitions, and seed data",
              },
              {
                icon: Database,
                title: "Validate",
                desc: "Pipeline runs 5 quality steps against real data — 100% quality score",
              },
              {
                icon: MessageSquare,
                title: "Serve",
                desc: "Chat app queries validated data with 6 governed AI tools",
              },
              {
                icon: FileCode2,
                title: "Improve",
                desc: "User feedback → Codex generates new pipeline steps and tools",
              },
            ].map((item) => (
              <Card key={item.title}>
                <CardContent className="pt-4 space-y-2">
                  <item.icon className="h-5 w-5 text-primary" />
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="border-t px-6 py-10">
        <div className="mx-auto max-w-4xl text-center space-y-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Built With
          </h2>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              "OpenAI Codex",
              "Next.js 15",
              "Vercel AI SDK v6",
              "shadcn/ui",
              "Turso / libSQL",
              "Drizzle ORM",
              "Recharts",
              "NextAuth v5",
              "Kanna UI patterns",
            ].map((tech) => (
              <Badge key={tech} variant="outline" className="text-xs">
                {tech}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t px-6 py-8">
        <div className="mx-auto max-w-2xl flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">
            Try the live demo
          </p>
          <div className="flex gap-3">
            <Link href="/pipeline">
              <Button variant="outline" size="sm">
                <GitBranch className="h-3.5 w-3.5 mr-1.5" />
                Run Pipeline
              </Button>
            </Link>
            <Link href="/chat">
              <Button size="sm">
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                Open Chat
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function ExpandableCard({
  title,
  badge,
  subtitle,
  description,
  extra,
}: {
  title: string;
  badge?: string;
  subtitle?: string;
  description: string;
  extra?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border">
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="font-mono font-medium">{title}</span>
        {badge && (
          <Badge variant="secondary" className="text-[9px]">
            {badge}
          </Badge>
        )}
        {subtitle && (
          <span className="text-muted-foreground text-[10px] ml-auto mr-2 hidden sm:inline">
            {subtitle}
          </span>
        )}
        {open ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto" />
        )}
      </button>
      {open && (
        <div className="px-3 pb-2.5 text-xs text-muted-foreground space-y-1">
          <p>{description}</p>
          {extra && (
            <p className="font-mono text-[10px]">{extra}</p>
          )}
        </div>
      )}
    </div>
  );
}
