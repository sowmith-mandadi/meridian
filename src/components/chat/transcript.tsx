"use client";

import { useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Bot,
  User,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Loader2,
  BrainCircuit,
  Clock,
  Coins,
  Timer,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { ToolResultRenderer } from "./tool-result-renderer";
import { StructuredTextRenderer } from "./structured-text-renderer";

interface ChatTranscriptProps {
  messages: UIMessage[];
  status: string;
}

export function ChatTranscript({ messages, status }: ChatTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const isStreaming = status === "streaming" || status === "submitted";

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, status]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="text-center space-y-5 animate-fade-in max-w-lg">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/10">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">Ask the governed assistant</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This demo uses 500 synthetic members (IDs like{" "}
              <span className="font-mono text-foreground/80">M-1042</span>) with claims, pharmacy,
              SDOH, utilization, and call-center data. Query cohorts by state, chronic conditions, and
              risk tier; drill into a member; chart aggregates; or draft outreach from risk drivers.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            {[
              "Find high-risk members with diabetes in TX and FL",
              "Explain member M-1042 including recent claims",
              "Generate a chart of claims volume by type",
              "Recommend outreach for M-1042 for transportation and medication adherence",
            ].map((hint) => (
              <button
                key={hint}
                className="text-left text-xs px-3 py-2.5 rounded-xl border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 group"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("meridian:prompt", { detail: hint })
                  );
                }}
              >
                <span className="flex items-center gap-1.5">
                  {hint}
                  <ArrowRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {messages.map((msg, idx) => (
          <MessageRow key={msg.id} message={msg} index={idx} />
        ))}
        {isStreaming && messages[messages.length - 1]?.role === "user" && (
          <div className="flex items-start gap-3 animate-fade-in-up">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shrink-0 shadow-sm shadow-primary/20">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm pt-2">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-subtle-pulse" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-subtle-pulse [animation-delay:0.2s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-subtle-pulse [animation-delay:0.4s]" />
              </div>
              <span className="text-xs">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={endRef} className="h-1" />
      </div>
    </div>
  );
}

function MessageRow({ message, index }: { message: UIMessage; index: number }) {
  const isUser = message.role === "user";
  const parts = message.parts ?? [];

  const toolParts = parts.filter(
    (p: any) => p?.type?.startsWith("tool-")
  );
  const toolTimeline = toolParts.map((p: any) => ({
    name: p.type.replace("tool-", ""),
    done: "result" in p && p.result != null,
    durationMs: p.result?._durationMs,
  }));

  return (
    <div
      className="animate-fade-in-up"
      style={{ animationDelay: `${Math.min(index * 0.04, 0.3)}s` }}
    >
      <div className={`flex gap-3 ${isUser ? "justify-end" : ""}`}>
        {!isUser && (
          <div className="shrink-0 mt-0.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-sm shadow-primary/20">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
          </div>
        )}
        <div
          className={`space-y-3 min-w-0 ${
            isUser ? "max-w-[80%]" : "flex-1"
          }`}
        >
          {parts.map((part, i) =>
            part ? (
              <PartRenderer
                key={i}
                part={part}
                isUser={isUser}
                messageHasTools={toolParts.length > 0}
              />
            ) : null
          )}

          {/* Tool execution timeline */}
          {!isUser && toolTimeline.length > 1 && (
            <div className="flex items-center gap-1 flex-wrap">
              <Timer className="h-3 w-3 text-muted-foreground shrink-0" />
              {toolTimeline.map((t, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Badge
                    variant="outline"
                    className={`text-[9px] font-mono transition-colors ${
                      t.done
                        ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                        : "border-amber-500/30 text-amber-600 dark:text-amber-300"
                    }`}
                  >
                    {t.done ? "\u2713" : "\u27F3"} {t.name}
                  </Badge>
                  {i < toolTimeline.length - 1 && (
                    <span className="text-muted-foreground text-[10px]">\u2192</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Token/cost footer */}
          {!isUser && parts.length > 0 && <MessageFooter />}
        </div>
        {isUser && (
          <div className="shrink-0 mt-0.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted ring-1 ring-border/50">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageFooter() {
  const [usage, setUsage] = useState<{
    tokensIn: number;
    tokensOut: number;
    latencyMs: number;
    model: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/usage/latest");
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (data) setUsage(data);
        }
      } catch {}
    }, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (!usage) return null;

  const totalTokens = usage.tokensIn + usage.tokensOut;
  const estimatedCost = (
    (usage.tokensIn * 0.00015 + usage.tokensOut * 0.0006) /
    1000
  ).toFixed(4);

  return (
    <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60 pt-1 animate-fade-in">
      <span className="flex items-center gap-1">
        <BrainCircuit className="h-2.5 w-2.5" />
        {usage.model}
      </span>
      <span className="flex items-center gap-1">
        <Coins className="h-2.5 w-2.5" />
        {totalTokens.toLocaleString()} tokens &middot; ~${estimatedCost}
      </span>
      <span className="flex items-center gap-1">
        <Clock className="h-2.5 w-2.5" />
        {(usage.latencyMs / 1000).toFixed(1)}s
      </span>
    </div>
  );
}

const TOOL_INFO: Record<string, { label: string; description: string }> = {
  identify_cohort: {
    label: "Identify Cohort",
    description: "Filters members by state, condition, and risk tier with SDOH context",
  },
  get_risk_drivers: {
    label: "Risk Drivers",
    description: "Analyzes top risk drivers from clinical, SDOH, and pharmacy data",
  },
  explain_member: {
    label: "Explain Member",
    description: "Produces a structured explanation of why a member is flagged",
  },
  recommend_outreach: {
    label: "Recommend Outreach",
    description: "Suggests prioritized interventions based on member risk drivers",
  },
  generate_chart: {
    label: "Generate Chart",
    description: "Builds chart-ready aggregates from the healthcare database",
  },
  submit_feedback: {
    label: "Submit Feedback",
    description: "Records a feature or metric request for product review",
  },
};

function PartRenderer({
  part,
  isUser,
  messageHasTools,
}: {
  part: any;
  isUser: boolean;
  messageHasTools: boolean;
}) {
  const result = part.result ?? part.output ?? null;
  const hasResult = result != null;
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    if (hasResult) setCollapsed(false);
  }, [hasResult]);

  if (part.type === "text") {
    if (!part.text) return null;

    if (isUser) {
      return (
        <div className="text-sm leading-relaxed bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm">
          {part.text}
        </div>
      );
    }

    const thinkMatch = part.text.match(
      /^>\s*\*\*Thinking[:\s]*\*\*\s*([\s\S]*?)(?:\n\n|$)/
    );
    const restText = thinkMatch
      ? part.text.slice(thinkMatch[0].length).trim()
      : null;

    return (
      <div className="space-y-2">
        {thinkMatch && (
          <div className="flex items-start gap-2 rounded-xl border border-purple-500/20 bg-purple-500/5 px-3 py-2">
            <BrainCircuit className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400 shrink-0 mt-0.5" />
            <div className="text-xs text-purple-700 dark:text-purple-300/90 leading-relaxed">
              <span className="font-medium text-purple-600 dark:text-purple-300">Thinking: </span>
              {thinkMatch[1].trim()}
            </div>
          </div>
        )}
        {(restText || !thinkMatch) && (
          <StructuredTextRenderer
            text={restText ?? part.text}
            inToolContext={messageHasTools}
          />
        )}
      </div>
    );
  }

  if (part.type.startsWith("tool-")) {
    const toolName = part.type.replace("tool-", "");
    const info = TOOL_INFO[toolName];
    const args = part.args ?? part.input ?? null;

    return (
      <Card className="border-border/60 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
        {/* Header */}
        <button
          className="flex w-full items-center gap-2 px-3 py-2.5 text-xs hover:bg-muted/50 transition-colors duration-150"
          onClick={() => setCollapsed((v) => !v)}
        >
          {hasResult ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          ) : (
            <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />
          )}
          <div className="flex flex-col items-start gap-0.5 min-w-0">
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px] font-mono shrink-0">
                {info?.label ?? toolName}
              </Badge>
              {args && (
                <span className="text-muted-foreground truncate text-[10px] font-mono">
                  {formatToolArgs(toolName, args)}
                </span>
              )}
            </div>
            {info && (
              <span className="text-[10px] text-muted-foreground leading-tight">
                {info.description}
              </span>
            )}
          </div>
          <span className="text-muted-foreground ml-auto flex items-center gap-1 shrink-0">
            {hasResult && (
              <span className="text-[10px] text-emerald-500 mr-1">done</span>
            )}
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </span>
        </button>

        {/* Expanded body */}
        {!collapsed && (
          <CardContent className="px-3 pb-3 pt-0 space-y-3 animate-fade-in">
            {args && typeof args === "object" && (
              <div className="rounded-lg bg-muted/50 p-2.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Input
                </p>
                <div className="text-xs font-mono text-foreground/80 space-y-0.5">
                  {Object.entries(args).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="text-muted-foreground shrink-0">{k}:</span>
                      <span className="break-all">
                        {Array.isArray(v) ? v.join(", ") : String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {hasResult ? (
              <>
                <Separator />
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Result
                  </p>
                  <ToolResultRenderer toolName={toolName} result={result} />
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Querying database...
              </div>
            )}
          </CardContent>
        )}
      </Card>
    );
  }

  return null;
}

function formatToolArgs(toolName: string, args: Record<string, any>): string {
  switch (toolName) {
    case "identify_cohort": {
      const parts: string[] = [];
      if (args.states?.length) parts.push(args.states.join(", "));
      if (args.conditions?.length) parts.push(args.conditions.join(", "));
      if (args.riskTier) parts.push(args.riskTier);
      return parts.join(" \u00B7 ") || "all";
    }
    case "get_risk_drivers":
    case "explain_member":
      return args.memberId || "";
    case "recommend_outreach":
      return args.memberId ? `${args.memberId}` : "";
    case "generate_chart":
      return `${args.chartType || "bar"}: ${args.dataQuery || ""}`;
    case "submit_feedback":
      return args.requestText?.slice(0, 40) || "";
    default:
      return JSON.stringify(args).slice(0, 60);
  }
}
