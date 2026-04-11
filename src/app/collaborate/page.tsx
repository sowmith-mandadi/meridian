"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Server,
  Shield,
  UserRound,
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

const STEP_DELAY_MS = 1000;

const TIMESTAMPS = [
  "09:14:02.118",
  "09:14:03.441",
  "09:14:05.902",
  "09:14:06.210",
];

export default function CollaboratePage() {
  /** 1–4: number of conversation steps revealed (client msg → permission → payload → governance). */
  const [visibleStep, setVisibleStep] = React.useState(1);

  React.useEffect(() => {
    if (visibleStep >= 4) return;
    const id = window.setTimeout(() => {
      setVisibleStep((s) => s + 1);
    }, STEP_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [visibleStep]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/80 bg-card/40 px-6 py-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Agent-to-Agent Collaboration
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Governed request flow between a consumer analytics agent and a
          data-owner host — permissions, scope, and PHI boundaries enforced
          before any response payload is returned.
        </p>
      </header>

      <Separator />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        {/* Client Agent */}
        <section className="flex min-h-[420px] flex-col border-b border-border lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 border-b border-border/80 bg-muted/30 px-4 py-3">
            <div className="flex size-9 items-center justify-center rounded-lg border bg-background">
              <UserRound className="size-4 text-primary" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium">Client Agent</p>
              <p className="text-xs text-muted-foreground">Consumer Team</p>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
            {visibleStep >= 1 ? (
              <Card
                className={cn(
                  "border-primary/20 shadow-sm transition-all duration-500",
                  "animate-in fade-in-0 slide-in-from-bottom-2"
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                      <ArrowRight
                        className="size-4 text-primary"
                        aria-hidden
                      />
                      Outbound request
                    </CardTitle>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {TIMESTAMPS[0]}
                    </span>
                  </div>
                  <CardDescription className="text-xs">
                    Risk analytics cohort query (aggregated).
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm leading-relaxed">
                  Request aggregated risk data for TX high-risk members
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                Waiting for client request…
              </div>
            )}
          </div>
        </section>

        {/* Host Agent */}
        <section className="flex min-h-[420px] flex-col">
          <div className="flex items-center gap-2 border-b border-border/80 bg-muted/30 px-4 py-3">
            <div className="flex size-9 items-center justify-center rounded-lg border bg-background">
              <Server className="size-4 text-primary" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium">Host Agent</p>
              <p className="text-xs text-muted-foreground">Data Owner</p>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
            {visibleStep >= 2 ? (
              <Card
                className={cn(
                  "border-emerald-500/20 shadow-sm transition-all duration-500",
                  "animate-in fade-in-0 slide-in-from-bottom-2"
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                      <ArrowLeft
                        className="size-4 text-emerald-400"
                        aria-hidden
                      />
                      Permission gate
                    </CardTitle>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {TIMESTAMPS[1]}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm leading-relaxed">
                  <p>
                    Permission check...{" "}
                    <span className="font-medium text-emerald-400">
                      APPROVED
                    </span>{" "}
                    (role: analyst, scope: aggregated)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <Shield className="size-3" aria-hidden />
                      Scoped to aggregated metrics
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {visibleStep >= 3 ? (
              <Card
                className={cn(
                  "border-primary/20 shadow-sm transition-all duration-500",
                  "animate-in fade-in-0 slide-in-from-bottom-2"
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                      <ArrowLeft
                        className="size-4 text-primary"
                        aria-hidden
                      />
                      Response payload
                    </CardTitle>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {TIMESTAMPS[2]}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="text-sm leading-relaxed">
                  47 high-risk members, avg risk score 0.78, top drivers:
                  transportation (55%), medication adherence (42%)
                </CardContent>
              </Card>
            ) : null}

            {visibleStep >= 4 ? (
              <Card
                className={cn(
                  "border-violet-500/25 bg-violet-500/5 shadow-sm transition-all duration-500",
                  "animate-in fade-in-0 zoom-in-95"
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                      <Shield
                        className="size-4 text-violet-300"
                        aria-hidden
                      />
                      Governance
                    </CardTitle>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {TIMESTAMPS[3]}
                    </span>
                  </div>
                  <CardDescription className="text-xs">
                    Automatic enforcement on egress from the host boundary.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge
                    variant="secondary"
                    className="border-violet-500/30 bg-violet-500/15 text-violet-200"
                  >
                    PHI filtered — aggregated data only
                  </Badge>
                </CardContent>
              </Card>
            ) : null}

            {visibleStep >= 2 ? null : (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                {visibleStep >= 1
                  ? "Host is evaluating permissions…"
                  : "Host idle until a request arrives."}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
