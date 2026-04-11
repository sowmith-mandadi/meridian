"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, Coins, Timer } from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type UsageRow = {
  id: string;
  queryText: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  model: string;
  createdAt: string;
};

export default function ObservePage() {
  const [logs, setLogs] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const res = await fetch("/api/usage");
        if (!res.ok) throw new Error("Failed to load usage");
        const data = (await res.json()) as UsageRow[];
        if (!cancelled) setLogs(data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load usage");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const n = logs.length;
    if (n === 0) {
      return {
        totalQueries: 0,
        avgLatencyMs: 0,
        totalTokens: 0,
      };
    }
    let latencySum = 0;
    let tokenSum = 0;
    for (const row of logs) {
      latencySum += row.latencyMs;
      tokenSum += row.tokensIn + row.tokensOut;
    }
    return {
      totalQueries: n,
      avgLatencyMs: Math.round(latencySum / n),
      totalTokens: tokenSum,
    };
  }, [logs]);

  const chartData = useMemo(() => {
    return logs.slice(0, 20).map((row, i) => ({
      name: `#${i + 1}`,
      tokens: row.tokensIn + row.tokensOut,
      query: row.queryText,
    }));
  }, [logs]);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col gap-8 p-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Observability
        </h1>
        <p className="mt-1 text-muted-foreground">
          Model usage, latency, and token consumption from recent assistant
          queries (up to 100 entries).
        </p>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Queries</CardTitle>
            <BarChart3 className="text-muted-foreground size-4" aria-hidden />
          </CardHeader>
          <CardContent>
            <div className="font-heading text-2xl font-semibold tabular-nums">
              {loading ? "—" : stats.totalQueries}
            </div>
            <CardDescription className="mt-1">
              Rows in the usage log (latest fetch)
            </CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Timer className="text-muted-foreground size-4" aria-hidden />
          </CardHeader>
          <CardContent>
            <div className="font-heading text-2xl font-semibold tabular-nums">
              {loading ? "—" : `${stats.avgLatencyMs} ms`}
            </div>
            <CardDescription className="mt-1">
              Mean across returned logs
            </CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <Coins className="text-muted-foreground size-4" aria-hidden />
          </CardHeader>
          <CardContent>
            <div className="font-heading text-2xl font-semibold tabular-nums">
              {loading ? "—" : stats.totalTokens.toLocaleString()}
            </div>
            <CardDescription className="mt-1">
              Sum of tokens in + tokens out
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Token usage per query</CardTitle>
          <CardDescription>
            Last 20 queries by recency (most recent first from the API).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[320px] w-full min-w-0">
            {loading ? (
              <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                Loading chart…
              </div>
            ) : chartData.length === 0 ? (
              <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                No usage data yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as {
                        name: string;
                        tokens: number;
                        query: string;
                      };
                      return (
                        <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-xs shadow-md">
                          <div className="font-medium">{p.name}</div>
                          <div className="text-muted-foreground mt-1 max-w-xs">
                            {p.query}
                          </div>
                          <div className="mt-2 tabular-nums">
                            {p.tokens.toLocaleString()} tokens
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="tokens"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Codex Activity</CardTitle>
          <Badge variant="outline" className="shrink-0">
            <Activity className="mr-1 size-3" aria-hidden />
            Dev
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm leading-relaxed">
            During development, Meridian was built using OpenAI Codex with custom
            subagents and skills. Codex generated tool definitions, seed data,
            and UI components.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
