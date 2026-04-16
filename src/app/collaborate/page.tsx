"use client";

import * as React from "react";
import {
  ArrowRight,
  Loader2,
  ScrollText,
  Server,
  Shield,
  UserRound,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { AppNav } from "@/components/app-nav";

type Role = "care_manager" | "analyst" | "quality" | "admin";

const ALL_QUERIES = [
  { label: "High-risk diabetic members in TX and FL", intent: "cohort", filters: { states: ["TX", "FL"], riskTier: "high", diabetesOnly: true }, scope: "member_level" },
  { label: "Dallas members with 3+ ER visits, no PCP", intent: "provider_coordination", filters: { metroAreaContains: "Dallas", minErVisits: 3, maxPcpVisits: 0, riskTier: "high" }, scope: "member_level" },
  { label: "Low adherence members (<60%)", intent: "pharmacy_review", filters: { adherenceBelow: 60, riskTier: "high" }, scope: "member_level" },
  { label: "Quality gap analysis (diabetic, high-risk)", intent: "quality_gap", filters: { riskTier: "high", diabetesOnly: true }, scope: "member_level" },
  { label: "Population aggregates by state", intent: "cohort", filters: { riskTier: "high" }, scope: "aggregated" },
  { label: "Member outreach for TX high-risk", intent: "member_outreach", filters: { states: ["TX"], riskTier: "high" }, scope: "member_level" },
  { label: "Full high-risk cohort (all states)", intent: "cohort", filters: { riskTier: "high" }, scope: "member_level" },
  { label: "Aggregated pharmacy review", intent: "pharmacy_review", filters: { adherenceBelow: 50, riskTier: "high" }, scope: "aggregated" },
];

interface GovernedResponse {
  status: string;
  role?: string;
  intent?: string;
  scope?: string;
  error?: string;
  summary?: { matchingMembers: number; avgProbability: number; highRiskMembers: number; states: string[] };
  records?: Record<string, unknown>[];
  governance?: { policyNote: string; blockedFields: string[]; auditId: string };
}

interface AuditEntry {
  id: string;
  userRole: string;
  action: string;
  resultSummary: string;
  blockedFields: string;
  policyNote: string;
  createdAt: string;
}

export default function CollaboratePage() {
  const [role, setRole] = React.useState<Role>("care_manager");
  const [selectedQuery, setSelectedQuery] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [response, setResponse] = React.useState<GovernedResponse | null>(null);
  const [auditLog, setAuditLog] = React.useState<AuditEntry[]>([]);

  const currentQuery = ALL_QUERIES[selectedQuery] ?? ALL_QUERIES[0];

  async function handleSend() {
    setLoading(true);
    setResponse(null);
    try {
      const res = await fetch("/api/collaborate/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          intent: currentQuery.intent,
          filters: currentQuery.filters,
          scope: currentQuery.scope,
          limit: 15,
        }),
      });
      const data = await res.json();
      setResponse(data);
      fetchAudit();
    } catch (err) {
      setResponse({ status: "error", error: String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function fetchAudit() {
    try {
      const res = await fetch("/api/audit");
      if (res.ok) {
        const data = await res.json();
        setAuditLog(data.slice(0, 10));
      }
    } catch { /* ignore */ }
  }

  React.useEffect(() => { fetchAudit(); }, []);
  React.useEffect(() => { setResponse(null); }, [role]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppNav />
      <header className="border-b border-border/80 bg-card/40 px-6 py-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Agent-to-Agent Collaboration
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Live governed request flow between a client agent and a data-owner host.
          Permissions, scope, and PHI boundaries are enforced before any response
          payload is returned.
        </p>
      </header>

      <Separator />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        {/* Client Agent */}
        <section className="flex flex-col border-b border-border lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 border-b border-border/80 bg-muted/30 px-4 py-3">
            <div className="flex size-9 items-center justify-center rounded-lg border bg-background">
              <UserRound className="size-4 text-primary" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium">Client Agent</p>
              <p className="text-xs text-muted-foreground">Consumer Team</p>
            </div>
          </div>
          <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Role</label>
                <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="care_manager">Care Manager</SelectItem>
                    <SelectItem value="analyst">Analyst / Pharmacy</SelectItem>
                    <SelectItem value="quality">Quality</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-[2]">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Query</label>
                <Select value={String(selectedQuery)} onValueChange={(v) => { setSelectedQuery(Number(v)); setResponse(null); }}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALL_QUERIES.map((q, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {q.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <ArrowRight className="size-4 text-primary" aria-hidden />
                  Request payload
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="overflow-auto rounded bg-muted/50 p-3 text-xs">
                  {JSON.stringify({ role, intent: currentQuery.intent, filters: currentQuery.filters, scope: currentQuery.scope, limit: 15 }, null, 2)}
                </pre>
              </CardContent>
            </Card>

            <Button onClick={handleSend} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              Send Governed Request
            </Button>
          </div>
        </section>

        {/* Host Agent */}
        <section className="flex flex-col">
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
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Evaluating permissions and querying data...
              </div>
            )}

            {response && response.status === "error" && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <Shield className="size-4" aria-hidden />
                    Request Blocked
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">{response.error}</CardContent>
              </Card>
            )}

            {response && response.status === "ok" && (
              <>
                <Card className="border-emerald-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                      <Shield className="size-4 text-emerald-400" aria-hidden />
                      Permission Gate
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>
                      Permission check...{" "}
                      <span className="font-medium text-emerald-400">APPROVED</span>
                      {" "}(role: {response.role}, scope: {response.scope})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="gap-1">
                        <Shield className="size-3" aria-hidden />
                        {response.scope === "aggregated" ? "Aggregated metrics only" : "Member-level with masking"}
                      </Badge>
                      {response.governance?.blockedFields && response.governance.blockedFields.length > 0 && (
                        <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                          {response.governance.blockedFields.length} fields blocked
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Response Summary</CardTitle>
                    <CardDescription className="text-xs">
                      {response.summary?.matchingMembers} members matched,{" "}
                      avg probability {((response.summary?.avgProbability ?? 0) * 100).toFixed(1)}%,{" "}
                      {response.summary?.highRiskMembers} high-risk
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {response.records && response.records.length > 0 && (
                      <div className="max-h-[300px] overflow-auto rounded border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {Object.keys(response.records[0]).filter((k) => k !== "sdoh").slice(0, 7).map((key) => (
                                <TableHead key={key} className="text-xs whitespace-nowrap">{key}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {response.records.slice(0, 10).map((rec, i) => (
                              <TableRow key={i}>
                                {Object.entries(rec).filter(([k]) => k !== "sdoh").slice(0, 7).map(([key, val]) => (
                                  <TableCell key={key} className="text-xs">
                                    {typeof val === "number" ? (val % 1 !== 0 ? val.toFixed(2) : val) : String(val ?? "")}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className={cn("border-violet-500/25 bg-violet-500/5")}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                      <Shield className="size-4 text-violet-300" aria-hidden />
                      Governance Metadata
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    <p><span className="text-muted-foreground">Policy:</span> {response.governance?.policyNote}</p>
                    <p><span className="text-muted-foreground">Blocked fields:</span>{" "}
                      {response.governance?.blockedFields?.length
                        ? response.governance.blockedFields.join(", ")
                        : "None"}
                    </p>
                    <p><span className="text-muted-foreground">Audit ID:</span>{" "}
                      <code className="rounded bg-muted px-1 py-0.5">{response.governance?.auditId}</code>
                    </p>
                  </CardContent>
                </Card>
              </>
            )}

            {!response && !loading && (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                Host idle — select a role and query, then send a governed request.
              </div>
            )}
          </div>
        </section>
      </div>

      <Separator />

      {/* Audit trail */}
      <section className="border-t border-border px-6 py-4">
        <div className="flex items-center gap-2 mb-3">
          <ScrollText className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-medium">Audit Trail</h2>
          <span className="text-xs text-muted-foreground">(last 10 governed requests)</span>
        </div>
        {auditLog.length === 0 ? (
          <p className="text-xs text-muted-foreground">No audit entries yet.</p>
        ) : (
          <div className="max-h-[200px] overflow-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Time</TableHead>
                  <TableHead className="text-xs">Role</TableHead>
                  <TableHead className="text-xs">Action</TableHead>
                  <TableHead className="text-xs">Result</TableHead>
                  <TableHead className="text-xs">Blocked Fields</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLog.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs font-mono whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleTimeString()}
                    </TableCell>
                    <TableCell className="text-xs">{entry.userRole}</TableCell>
                    <TableCell className="text-xs">{entry.action}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{entry.resultSummary}</TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate">{entry.blockedFields || "None"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
