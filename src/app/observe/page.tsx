"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, Coins, Shield, Timer } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppNav } from "@/components/app-nav";

type UsageRow = {
  id: string;
  queryText: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  model: string;
  createdAt: string;
};

type AuditRow = {
  id: string;
  userId: string;
  userRole: string;
  action: string;
  toolArgs: string;
  resultSummary: string;
  blockedFields: string;
  policyNote: string;
  createdAt: string;
};

export default function ObservePage() {
  const [logs, setLogs] = useState<UsageRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const [usageRes, auditRes] = await Promise.all([
          fetch("/api/usage"),
          fetch("/api/audit"),
        ]);
        if (!usageRes.ok) throw new Error("Failed to load usage");
        const usageData = (await usageRes.json()) as UsageRow[];
        const auditData = auditRes.ok ? ((await auditRes.json()) as AuditRow[]) : [];
        if (!cancelled) {
          setLogs(usageData);
          setAuditLogs(auditData);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const n = logs.length;
    if (n === 0) return { totalQueries: 0, avgLatencyMs: 0, totalTokens: 0 };
    let latencySum = 0;
    let tokenSum = 0;
    for (const row of logs) {
      latencySum += row.latencyMs;
      tokenSum += row.tokensIn + row.tokensOut;
    }
    return { totalQueries: n, avgLatencyMs: Math.round(latencySum / n), totalTokens: tokenSum };
  }, [logs]);

  const auditStats = useMemo(() => {
    const n = auditLogs.length;
    const blockedCount = auditLogs.filter((r) => r.blockedFields && r.blockedFields.length > 0).length;
    const roleBreakdown: Record<string, number> = {};
    for (const row of auditLogs) {
      roleBreakdown[row.userRole] = (roleBreakdown[row.userRole] ?? 0) + 1;
    }
    return { totalEvents: n, blockedFieldEvents: blockedCount, roleBreakdown };
  }, [auditLogs]);

  const chartData = useMemo(() => {
    return logs.slice(0, 20).map((row, i) => ({
      name: `#${i + 1}`,
      tokens: row.tokensIn + row.tokensOut,
      query: row.queryText,
    }));
  }, [logs]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppNav />
      <div className="mx-auto flex flex-1 max-w-6xl flex-col gap-8 p-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Observability
        </h1>
        <p className="mt-1 text-muted-foreground">
          Model usage, governance audit trail, latency, and token consumption.
        </p>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">{error}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Queries</CardTitle>
            <BarChart3 className="text-muted-foreground size-4" aria-hidden />
          </CardHeader>
          <CardContent>
            <div className="font-heading text-2xl font-semibold tabular-nums">
              {loading ? "—" : stats.totalQueries}
            </div>
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
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Audit Events</CardTitle>
            <Shield className="text-muted-foreground size-4" aria-hidden />
          </CardHeader>
          <CardContent>
            <div className="font-heading text-2xl font-semibold tabular-nums">
              {loading ? "—" : auditStats.totalEvents}
            </div>
            <CardDescription className="mt-1">
              {auditStats.blockedFieldEvents} with field restrictions
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="usage" className="w-full">
        <TabsList>
          <TabsTrigger value="usage">Model Usage</TabsTrigger>
          <TabsTrigger value="audit">Governance Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Token usage per query</CardTitle>
              <CardDescription>Last 20 queries by recency.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] w-full min-w-0">
                {loading ? (
                  <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Loading chart...</div>
                ) : chartData.length === 0 ? (
                  <div className="text-muted-foreground flex h-full items-center justify-center text-sm">No usage data yet.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const p = payload[0].payload as { name: string; tokens: number; query: string };
                          return (
                            <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-xs shadow-md">
                              <div className="font-medium">{p.name}</div>
                              <div className="text-muted-foreground mt-1 max-w-xs">{p.query}</div>
                              <div className="mt-2 tabular-nums">{p.tokens.toLocaleString()} tokens</div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="tokens" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {Object.entries(auditStats.roleBreakdown).map(([role, count]) => (
              <Card key={role}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium capitalize">{role.replace("_", " ")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-heading text-xl font-semibold tabular-nums">{count}</div>
                  <CardDescription>tool invocations</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Governance Audit Log</CardTitle>
              <CardDescription>Every tool invocation and governed query with role, action, and field restrictions.</CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <p className="text-muted-foreground text-sm">No audit entries yet. Use the chat or collaborate pages to generate audit events.</p>
              ) : (
                <div className="max-h-[400px] overflow-auto rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Time</TableHead>
                        <TableHead className="text-xs">Role</TableHead>
                        <TableHead className="text-xs">Action</TableHead>
                        <TableHead className="text-xs">Result</TableHead>
                        <TableHead className="text-xs">Blocked Fields</TableHead>
                        <TableHead className="text-xs">Policy</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-xs font-mono whitespace-nowrap">
                            {new Date(entry.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-xs">{entry.userRole}</Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono">{entry.action}</TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">{entry.resultSummary}</TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate">
                            {entry.blockedFields || <span className="text-muted-foreground">None</span>}
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">{entry.policyNote}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
            and UI components. All tool calls are now audited with role-based governance.
          </p>
        </CardContent>
      </Card>
    </div>
    </div>
  );
}
