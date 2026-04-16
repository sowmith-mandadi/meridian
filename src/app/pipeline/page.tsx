"use client";

import * as React from "react";
import {
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  Database,
  GitMerge,
  Link2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type StepStatus = "completed" | "running" | "pending";

type PipelineStep = {
  id: string;
  name: string;
  icon: React.ElementType;
  status: StepStatus;
  detail: string;
};

const STEPS: PipelineStep[] = [
  {
    id: "ingest",
    name: "Ingest",
    icon: Database,
    status: "completed",
    detail:
      "Claims, pharmacy, SDOH, and call-center feeds landed in the raw zone with checksum validation and lineage IDs attached.",
  },
  {
    id: "profile",
    name: "Profile",
    icon: BarChart3,
    status: "completed",
    detail:
      "Column-level stats, null rates, and distribution snapshots computed for downstream standardization rules.",
  },
  {
    id: "standardize",
    name: "Standardize",
    icon: GitMerge,
    status: "completed",
    detail:
      "ICD-10/CPT/NDC normalized to reference vocabularies; dates aligned to analytics calendar.",
  },
  {
    id: "entity-resolve",
    name: "Entity Resolve",
    icon: Link2,
    status: "completed",
    detail:
      "Member keys reconciled across sources with deterministic merge rules and conflict surfacing.",
  },
  {
    id: "validate",
    name: "Validate",
    icon: ShieldCheck,
    status: "completed",
    detail:
      "Quality gates on grain, referential integrity, and business rules before publishing the analytics-ready dataset.",
  },
];

function StatusBadge({ status }: { status: StepStatus }) {
  if (status === "completed") {
    return (
      <Badge
        variant="secondary"
        className="border-emerald-500/30 bg-emerald-500/15 text-emerald-400 [&>svg]:text-emerald-400"
      >
        <Check className="size-3" aria-hidden />
        Completed
      </Badge>
    );
  }
  if (status === "running") {
    return (
      <Badge
        variant="secondary"
        className="border-amber-500/30 bg-amber-500/15 text-amber-300 [&>svg]:text-amber-300"
      >
        <Loader2 className="size-3 animate-spin" aria-hidden />
        Running
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Pending
    </Badge>
  );
}

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
  const [selectedId, setSelectedId] = React.useState<string | null>(
    STEPS[0]?.id ?? null
  );

  const selected = STEPS.find((s) => s.id === selectedId) ?? STEPS[0];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/80 bg-card/40 px-6 py-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Agentic Data Pipeline
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          End-to-end orchestration from governed ingest through validation for
          analytics-ready healthcare datasets.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-8 lg:px-8">
          <div className="flex w-full max-w-6xl flex-col items-center gap-0 md:flex-row md:items-center md:justify-between md:gap-2">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isSelected = selectedId === step.id;
              return (
                <React.Fragment key={step.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(step.id)}
                    className={cn(
                      "flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border p-4 text-left transition-colors md:max-w-[160px] md:min-w-[140px]",
                      "ring-1 ring-foreground/10 hover:bg-muted/40",
                      isSelected &&
                        "bg-muted/50 ring-2 ring-primary/40 ring-offset-2 ring-offset-background"
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-12 items-center justify-center rounded-lg border bg-background",
                        isSelected ? "border-primary/50" : "border-border"
                      )}
                    >
                      <Icon className="size-6 text-primary" aria-hidden />
                    </div>
                    <div className="flex w-full flex-col items-center gap-2">
                      <span className="text-center font-medium leading-tight">
                        {step.name}
                      </span>
                      <StatusBadge status={step.status} />
                    </div>
                  </button>
                  {index < STEPS.length - 1 ? (
                    <>
                      <div
                        className="flex h-10 flex-col items-center justify-center md:hidden"
                        aria-hidden
                      >
                        <div className="h-3 w-px shrink-0 bg-border" />
                        <ChevronDown className="size-4 text-muted-foreground" />
                        <div className="h-3 w-px shrink-0 bg-border" />
                      </div>
                      <div
                        className="hidden h-px min-w-[20px] flex-1 items-center md:flex"
                        aria-hidden
                      >
                        <div className="h-px flex-1 bg-border" />
                        <ChevronRight className="mx-1 size-4 shrink-0 text-muted-foreground" />
                        <div className="h-px flex-1 bg-border" />
                      </div>
                    </>
                  ) : null}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <Separator orientation="vertical" className="hidden lg:block" />

        <aside className="w-full shrink-0 border-t border-border lg:w-96 lg:border-l lg:border-t-0">
          <div className="sticky top-0 flex h-full min-h-[280px] flex-col gap-4 p-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Step details
              </p>
              <h2 className="mt-1 font-heading text-lg font-semibold">
                {selected?.name ?? "Select a step"}
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {selected?.detail}
            </p>
            <div className="mt-auto rounded-lg border border-dashed border-border/80 bg-muted/30 p-3 text-xs text-muted-foreground">
              Click any node in the DAG to inspect ingest, profiling, and
              validation context for that stage.
            </div>
          </div>
        </aside>
      </div>

      <section className="border-t border-border bg-muted/20 px-4 py-8">
        <Card className="mx-auto max-w-4xl">
          <CardHeader>
            <CardTitle className="font-mono text-sm">tech_specs.yml</CardTitle>
            <CardDescription>
              Declarative pipeline contract for the hospitalization risk
              feature set.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[min(420px,50vh)] overflow-auto rounded-lg border bg-background p-4 font-mono text-xs leading-relaxed text-foreground">
              {TECH_SPECS}
            </pre>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
