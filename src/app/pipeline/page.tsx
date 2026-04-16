"use client";

import { useState, useCallback } from "react";
import {
  BarChart3,
  Check,
  ChevronRight,
  Database,
  GitMerge,
  Link2,
  Loader2,
  Play,
  ShieldCheck,
  Clock,
  Zap,
  RotateCcw,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import { AppNav } from "@/components/app-nav";

type StepStatus = "idle" | "running" | "completed" | "failed";

interface StepResult {
  step: string;
  status: string;
  durationMs: number;
  output: Record<string, unknown>;
}

interface PipelineStep {
  id: string;
  name: string;
  icon: React.ElementType;
  status: StepStatus;
  description: string;
  result: StepResult | null;
}

const STEP_DEFS: Omit<PipelineStep, "status" | "result">[] = [
  {
    id: "ingest",
    name: "Ingest",
    icon: Database,
    description: "Pull raw records from all source tables and validate checksums",
  },
  {
    id: "profile",
    name: "Profile",
    icon: BarChart3,
    description: "Compute column stats, null rates, and distribution snapshots",
  },
  {
    id: "standardize",
    name: "Standardize",
    icon: GitMerge,
    description: "Validate ICD-10/NDC codes and normalize date formats",
  },
  {
    id: "entity_resolve",
    name: "Entity Resolve",
    icon: Link2,
    description: "Link member records across all data sources",
  },
  {
    id: "validate",
    name: "Validate",
    icon: ShieldCheck,
    description: "Run quality gates: grain, referential integrity, business rules",
  },
];

const TECH_SPECS = `pipeline:
  name: hospitalization_risk_prediction
  version: "1.0"
  sources:
    - claims_data (ICD-10, CPT, member_id, dates)
    - pharmacy_data (NDC, adherence, fill_dates)
    - sdoh_indicators (transportation, food, housing)
    - call_center_logs (reason, sentiment, dates)
  output:
    format: analytics_ready_dataset
    grain: member_month
    features: 47
    target: hospital_visit_6mo`;

export default function PipelinePage() {
  const [steps, setSteps] = useState<PipelineStep[]>(
    STEP_DEFS.map((d) => ({ ...d, status: "idle", result: null }))
  );
  const [selectedId, setSelectedId] = useState<string>("ingest");
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<StepResult | null>(null);

  const selected = steps.find((s) => s.id === selectedId) ?? steps[0];

  const runPipeline = useCallback(async () => {
    setRunning(true);
    setSummary(null);
    setSteps((prev) =>
      prev.map((s) => ({ ...s, status: "idle", result: null }))
    );

    try {
      const res = await fetch("/api/pipeline", { method: "POST" });
      if (!res.ok || !res.body) throw new Error("Pipeline request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let stepIndex = 0;

      // Mark first step as running
      setSteps((prev) =>
        prev.map((s, i) => (i === 0 ? { ...s, status: "running" } : s))
      );
      setSelectedId(STEP_DEFS[0].id);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const result: StepResult = JSON.parse(line);

          if (result.step === "summary") {
            setSummary(result);
            continue;
          }

          const currentIndex = stepIndex;
          setSteps((prev) =>
            prev.map((s, i) => {
              if (i === currentIndex) {
                return {
                  ...s,
                  status: result.status === "completed" ? "completed" : "failed",
                  result,
                };
              }
              if (i === currentIndex + 1) {
                return { ...s, status: "running" };
              }
              return s;
            })
          );
          setSelectedId(result.step);
          stepIndex++;
        }
      }
    } catch (err) {
      console.error("Pipeline error:", err);
    } finally {
      setRunning(false);
    }
  }, []);

  const reset = useCallback(() => {
    setSteps(STEP_DEFS.map((d) => ({ ...d, status: "idle", result: null })));
    setSummary(null);
    setSelectedId("ingest");
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppNav />
      {/* Header */}
      <header className="border-b px-6 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Agentic Data Pipeline
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            End-to-end orchestration with real database queries against{" "}
            {steps[0]?.result
              ? `${(steps[0].result.output as any).total_records?.toLocaleString()} records`
              : "live data"}
          </p>
        </div>
        <div className="flex gap-2">
          {summary && (
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reset
            </Button>
          )}
          <Button onClick={runPipeline} disabled={running} size="sm">
            {running ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 mr-1.5" />
            )}
            {running ? "Running..." : "Run Pipeline"}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* DAG */}
        <div className="flex flex-1 items-center justify-center px-4 py-8">
          <div className="flex w-full max-w-5xl flex-col items-center gap-0 md:flex-row md:items-center md:justify-between md:gap-2">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isSelected = selectedId === step.id;
              return (
                <div key={step.id} className="flex items-center gap-0 md:gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedId(step.id)}
                    className={cn(
                      "flex w-full flex-col items-center gap-2.5 rounded-xl border p-4 transition-all md:w-[140px]",
                      "hover:bg-muted/40",
                      isSelected && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background bg-muted/50",
                      step.status === "completed" && "border-emerald-500/30",
                      step.status === "running" && "border-amber-500/30",
                      step.status === "failed" && "border-destructive/30"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-lg border",
                        step.status === "completed"
                          ? "border-emerald-500/40 bg-emerald-500/10"
                          : step.status === "running"
                          ? "border-amber-500/40 bg-amber-500/10"
                          : "border-border bg-background"
                      )}
                    >
                      {step.status === "running" ? (
                        <Loader2 className="h-5 w-5 text-amber-400 animate-spin" />
                      ) : step.status === "completed" ? (
                        <Check className="h-5 w-5 text-emerald-400" />
                      ) : (
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <span className="text-xs font-medium text-center leading-tight">
                      {step.name}
                    </span>
                    <StepStatusBadge status={step.status} durationMs={step.result?.durationMs} />
                  </button>
                  {index < steps.length - 1 && (
                    <div className="hidden md:flex items-center px-1" aria-hidden>
                      <div className="h-px w-4 bg-border" />
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="h-px w-4 bg-border" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <Separator orientation="vertical" className="hidden lg:block" />

        {/* Detail panel */}
        <aside className="w-full shrink-0 border-t lg:w-[400px] lg:border-l lg:border-t-0 overflow-y-auto">
          <div className="p-5 space-y-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Step details
              </p>
              <h2 className="mt-1 text-lg font-semibold">{selected.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {selected.description}
              </p>
            </div>

            {selected.result ? (
              <StepOutput result={selected.result} />
            ) : selected.status === "running" ? (
              <div className="flex items-center gap-2 text-sm text-amber-400 py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Querying database...
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4">
                Click &ldquo;Run Pipeline&rdquo; to execute this step with real data.
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* Summary + Tech Specs */}
      <section className="border-t bg-muted/20 px-4 py-6">
        <div className="mx-auto max-w-5xl grid gap-4 md:grid-cols-2">
          {/* Summary card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Pipeline Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summary ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Steps</span>
                    <span className="font-mono">
                      {(summary.output as any).stepsCompleted}/{(summary.output as any).stepsTotal}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total time</span>
                    <span className="font-mono">
                      {(summary.output as any).totalDurationMs}ms
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quality score</span>
                    <span className="font-mono text-emerald-400">
                      {(summary.output as any).qualityScore}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ready for modeling</span>
                    <Badge
                      variant={
                        (summary.output as any).readyForModeling
                          ? "secondary"
                          : "destructive"
                      }
                      className={cn(
                        "text-[10px]",
                        (summary.output as any).readyForModeling &&
                          "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      )}
                    >
                      {(summary.output as any).readyForModeling ? "Yes" : "No"}
                    </Badge>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Run the pipeline to see results.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Tech specs */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-mono text-sm">tech_specs.yml</CardTitle>
              <CardDescription className="text-xs">
                Declarative pipeline contract
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-auto rounded-lg border bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground max-h-[200px]">
                {TECH_SPECS}
              </pre>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function StepStatusBadge({
  status,
  durationMs,
}: {
  status: StepStatus;
  durationMs?: number;
}) {
  if (status === "completed") {
    return (
      <Badge
        variant="secondary"
        className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      >
        <Check className="h-2.5 w-2.5 mr-0.5" />
        {durationMs != null ? `${durationMs}ms` : "Done"}
      </Badge>
    );
  }
  if (status === "running") {
    return (
      <Badge
        variant="secondary"
        className="text-[10px] bg-amber-500/15 text-amber-300 border-amber-500/30"
      >
        <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" />
        Running
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="destructive" className="text-[10px]">
        Failed
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] text-muted-foreground">
      <Clock className="h-2.5 w-2.5 mr-0.5" />
      Idle
    </Badge>
  );
}

function StepOutput({ result }: { result: StepResult }) {
  const output = result.output;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <Badge
          variant="secondary"
          className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
        >
          Completed in {result.durationMs}ms
        </Badge>
      </div>
      <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
        {Object.entries(output).map(([key, value]) => (
          <OutputRow key={key} label={key} value={value} />
        ))}
      </div>
    </div>
  );
}

function OutputRow({ label, value }: { label: string; value: unknown }) {
  const displayLabel = label
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .trim();

  if (value && typeof value === "object" && !Array.isArray(value)) {
    return (
      <div className="space-y-1">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {displayLabel}
        </p>
        <div className="pl-2 border-l border-border/50 space-y-1">
          {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
            <OutputRow key={k} label={k} value={v} />
          ))}
        </div>
      </div>
    );
  }

  if (Array.isArray(value)) {
    return (
      <div className="space-y-1">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {displayLabel}
        </p>
        {value.map((item, i) => (
          <div
            key={i}
            className="text-xs font-mono text-foreground/80 pl-2 border-l border-border/50"
          >
            {typeof item === "object"
              ? Object.entries(item)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")
              : String(item)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{displayLabel}</span>
      <span className="font-mono text-foreground/90">{String(value)}</span>
    </div>
  );
}
