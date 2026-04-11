"use client";

import { useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bot,
  User,
  ChevronDown,
  ChevronRight,
  Wrench,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ToolResultRenderer } from "./tool-result-renderer";

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
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Bot className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold">What can I help you with?</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Ask about member cohorts, risk drivers, outreach recommendations, or
            explore population health data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {messages.map((msg) => (
          <MessageRow key={msg.id} message={msg} />
        ))}
        {isStreaming && messages[messages.length - 1]?.role === "user" && (
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary shrink-0">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm pt-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Thinking...
            </div>
          </div>
        )}
        <div ref={endRef} className="h-1" />
      </div>
    </div>
  );
}

function MessageRow({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : ""}`}>
      {!isUser && (
        <div className="shrink-0 mt-0.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
        </div>
      )}
      <div
        className={`space-y-3 min-w-0 ${
          isUser ? "max-w-[80%]" : "flex-1"
        }`}
      >
        {(message.parts ?? []).map((part, i) =>
          part ? <PartRenderer key={i} part={part} isUser={isUser} /> : null
        )}
      </div>
      {isUser && (
        <div className="shrink-0 mt-0.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
            <User className="h-4 w-4" />
          </div>
        </div>
      )}
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

function PartRenderer({ part, isUser }: { part: any; isUser: boolean }) {
  const result = part.result ?? part.output ?? null;
  const hasResult = result != null;
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    if (hasResult) setCollapsed(false);
  }, [hasResult]);

  if (part.type === "text") {
    if (!part.text) return null;
    return (
      <div
        className={`text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5"
            : "prose prose-sm prose-invert max-w-none"
        }`}
      >
        {isUser ? (
          part.text
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
        )}
      </div>
    );
  }

  if (part.type.startsWith("tool-")) {
    const toolName = part.type.replace("tool-", "");
    const info = TOOL_INFO[toolName];
    const args = part.args ?? part.input ?? null;

    return (
      <Card className="border-dashed overflow-hidden">
        {/* Header */}
        <button
          className="flex w-full items-center gap-2 px-3 py-2.5 text-xs hover:bg-muted/50 transition-colors"
          onClick={() => setCollapsed((v) => !v)}
        >
          {hasResult ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          ) : (
            <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin shrink-0" />
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
          <CardContent className="px-3 pb-3 pt-0 space-y-3">
            {args && typeof args === "object" && (
              <div className="rounded-md bg-muted/50 p-2">
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
      return parts.join(" · ") || "all";
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
