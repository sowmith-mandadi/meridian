"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Info,
  Shield,
  AlertTriangle,
  Database,
  Users,
  Activity,
  BarChart3,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const CHART_COLORS = [
  "oklch(0.65 0.17 200)",
  "oklch(0.70 0.14 160)",
  "oklch(0.60 0.12 280)",
  "oklch(0.68 0.16 40)",
  "oklch(0.62 0.14 320)",
];

interface ToolResult {
  toolName: string;
  result: any;
}

interface ExplainPanelProps {
  toolResult: ToolResult | null;
  allResults?: ToolResult[];
}

export function ExplainPanel({ toolResult, allResults = [] }: ExplainPanelProps) {
  return (
    <div className="flex h-full flex-col border-l border-border/60 bg-card/50 animate-slide-in-right">
      <div className="flex items-center gap-2 px-4 py-3.5 border-b shrink-0">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
          <Info className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-sm font-medium tracking-tight">Explainability</span>
        {toolResult && (
          <Badge variant="secondary" className="ml-auto text-[10px] font-mono">
            {toolResult.toolName}
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {allResults.length === 0 ? (
            <DefaultOverview />
          ) : (
            <>
              {toolResult && (
                <div className="animate-fade-in-up">
                  <ExplainContent
                    toolName={toolResult.toolName}
                    result={toolResult.result}
                  />
                </div>
              )}

              {allResults.length > 1 && (
                <>
                  <Separator />
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Earlier results ({allResults.length - 1})
                  </p>
                  {allResults.slice(0, -1).reverse().map((tr, i) => (
                    <div key={i} className="animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                      <PreviousResultCard toolName={tr.toolName} result={tr.result} />
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      <div className="border-t px-4 py-2.5 flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
        <Shield className="h-3 w-3 text-primary/60" />
        Governed output &mdash; no raw PHI exposed
      </div>
    </div>
  );
}

function DefaultOverview() {
  return (
    <div className="space-y-4 animate-fade-in">
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-primary" />
            Dataset Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          {[
            { label: "Members", value: "500" },
            { label: "States", value: "TX, FL, CA, NY, GA" },
            { label: "Risk tiers", value: "high / medium / low" },
            { label: "Total records", value: "~6,500" },
          ].map((row) => (
            <div key={row.label} className="flex justify-between items-center">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-mono text-foreground/80">{row.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-primary" />
            Data Sources
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-1.5">
          {[
            { name: "Claims", desc: "ICD-10, CPT, amounts, providers" },
            { name: "Pharmacy", desc: "Drug names, adherence %, fill dates" },
            { name: "SDOH", desc: "Transportation, food, housing flags" },
            { name: "Call Center", desc: "Reason, sentiment, dates" },
            { name: "Utilization", desc: "ER, inpatient, PCP visits" },
          ].map((s) => (
            <div key={s.name} className="flex items-start gap-2">
              <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5 border-primary/20 text-primary">
                {s.name}
              </Badge>
              <span className="text-muted-foreground">{s.desc}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center px-2 leading-relaxed">
        Run a chat query to mirror tool output here: cohort tables, risk drivers and member
        explanations (use member IDs like M-1042), Recharts-ready aggregates, and outreach plans.
      </p>
    </div>
  );
}

function PreviousResultCard({ toolName, result }: { toolName: string; result: any }) {
  const summary = getResultSummary(toolName, result);
  return (
    <div className="rounded-xl border border-border/60 p-2.5 text-xs space-y-0.5 hover:border-primary/20 transition-colors duration-150">
      <div className="flex items-center gap-1.5">
        <Badge variant="secondary" className="text-[9px] font-mono">
          {toolName}
        </Badge>
        <span className="text-muted-foreground text-[10px]">{summary}</span>
      </div>
    </div>
  );
}

function getResultSummary(toolName: string, result: any): string {
  switch (toolName) {
    case "identify_cohort":
      return `${result?.count ?? 0} members found`;
    case "get_risk_drivers":
      return `${result?.drivers?.length ?? 0} drivers for ${result?.member?.id ?? "?"}`;
    case "explain_member":
      return `Explanation for ${result?.sections?.demographics?.id ?? "?"}`;
    case "recommend_outreach":
      return `${result?.recommendations?.length ?? 0} actions for ${result?.memberName ?? "?"}`;
    case "generate_chart":
      return result?.title ?? "Chart generated";
    case "submit_feedback":
      return "Feedback submitted";
    default:
      return "Completed";
  }
}

function ExplainContent({ toolName, result }: { toolName: string; result: any }) {
  switch (toolName) {
    case "identify_cohort":
      return <CohortExplain result={result} />;
    case "get_risk_drivers":
      return <DriversExplain result={result} />;
    case "recommend_outreach":
      return <OutreachExplain result={result} />;
    case "explain_member":
      return <MemberExplain result={result} />;
    case "generate_chart":
      return <ChartExplain result={result} />;
    default:
      return (
        <pre className="text-[10px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(result, null, 2)}
        </pre>
      );
  }
}

function CohortExplain({ result }: { result: any }) {
  const members = result?.members?.slice(0, 5) ?? [];
  const sdohCounts = { transportation: 0, food: 0, housing: 0 };
  for (const m of result?.members ?? []) {
    if (m.sdoh?.transportationBarrier) sdohCounts.transportation++;
    if (m.sdoh?.foodInsecurity) sdohCounts.food++;
    if (m.sdoh?.housingInstability) sdohCounts.housing++;
  }
  const driverData = [
    { name: "Transportation", value: sdohCounts.transportation },
    { name: "Food Insecurity", value: sdohCounts.food },
    { name: "Housing", value: sdohCounts.housing },
  ];

  return (
    <div className="space-y-4">
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-primary" />
            Cohort Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Members found</span>
            <span className="font-mono font-medium">{result?.count ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">States</span>
            <span className="font-mono">
              {[...new Set((result?.members ?? []).map((m: any) => m.state))].join(", ")}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs">SDOH Drivers in Cohort</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={driverData} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" tick={{ fontSize: 9 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={75} />
                <Tooltip />
                <Bar dataKey="value" fill="oklch(0.65 0.17 200)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {members.length > 0 && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">Top Members</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {members.map((m: any) => (
              <MemberCard key={m.id} member={m} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DriversExplain({ result }: { result: any }) {
  return (
    <div className="space-y-4">
      {result?.member && <MemberCard member={result.member} />}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs">Risk Drivers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={result?.drivers ?? []} layout="vertical" margin={{ left: 90 }}>
                <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 9 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={85} />
                <Tooltip />
                <Bar dataKey="score" fill="oklch(0.65 0.17 200)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      {result?.avgAdherencePct != null && (
        <div className="text-xs text-muted-foreground">
          Avg medication adherence: <span className="font-mono font-medium text-foreground">{result.avgAdherencePct.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

function OutreachExplain({ result }: { result: any }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Outreach plan for <strong className="text-foreground">{result?.memberName ?? "member"}</strong>
      </p>
      {(result?.recommendations ?? []).map((r: any, i: number) => (
        <Card key={i} className="border-border/60 shadow-sm">
          <CardContent className="pt-3 text-xs space-y-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3 w-3 text-muted-foreground" />
              <Badge
                variant={r.priority === "high" ? "destructive" : "secondary"}
                className="text-[10px]"
              >
                {r.priority}
              </Badge>
            </div>
            <p className="font-medium">{r.action}</p>
            <p className="text-muted-foreground">{r.rationale}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MemberExplain({ result }: { result: any }) {
  const sections = result?.sections;
  if (!sections) {
    return (
      <pre className="text-[10px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
        {JSON.stringify(result, null, 2)}
      </pre>
    );
  }

  return (
    <div className="space-y-4">
      {sections.overview && (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-3 text-xs text-muted-foreground leading-relaxed">
            {sections.overview.summary}
          </CardContent>
        </Card>
      )}

      {sections.demographics && (
        <MemberCard
          member={{
            id: sections.demographics.id,
            name: sections.demographics.name,
            age: sections.demographics.age,
            gender: sections.demographics.gender,
            state: sections.demographics.state,
            riskScore: sections.clinical?.riskScore,
            riskTier: sections.clinical?.riskTier,
            chronicConditions: sections.clinical?.chronicConditions,
          }}
        />
      )}

      {sections.sdoh && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">Social Determinants</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1">
            {sections.sdoh.transportationBarrier && (
              <Badge variant="outline" className="text-[10px]">Transportation barrier</Badge>
            )}
            {sections.sdoh.foodInsecurity && (
              <Badge variant="outline" className="text-[10px]">Food insecurity</Badge>
            )}
            {sections.sdoh.housingInstability && (
              <Badge variant="outline" className="text-[10px]">Housing instability</Badge>
            )}
            {!sections.sdoh.transportationBarrier && !sections.sdoh.foodInsecurity && !sections.sdoh.housingInstability && (
              <span className="text-xs text-muted-foreground">No SDOH flags</span>
            )}
          </CardContent>
        </Card>
      )}

      {sections.pharmacy?.fills?.length > 0 && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">Pharmacy ({sections.pharmacy.fills.length} fills)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {sections.pharmacy.fills.slice(0, 5).map((rx: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span>{rx.drugName}</span>
                <Badge
                  variant={rx.adherencePct < 50 ? "destructive" : "secondary"}
                  className="text-[9px]"
                >
                  {rx.adherencePct}%
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {sections.claims && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">Claims Summary</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total claims</span>
              <span className="font-mono">{sections.claims.claimCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total amount</span>
              <span className="font-mono">${sections.claims.totalAmount?.toLocaleString()}</span>
            </div>
            {sections.claims.countsByType && (
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.entries(sections.claims.countsByType).map(([type, count]) => (
                  <Badge key={type} variant="outline" className="text-[9px]">
                    {type}: {String(count)}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ChartExplain({ result }: { result: any }) {
  const items = result?.data ?? [];
  const chartType = result?.type ?? "bar";

  return (
    <div className="space-y-3">
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
            {result?.title ?? "Chart"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "pie" ? (
                <PieChart>
                  <Pie data={items} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                    {items.map((_: any, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              ) : (
                <BarChart data={items} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="oklch(0.65 0.17 200)" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {items.length > 0 && (
        <div className="space-y-1">
          {items.map((item: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{item.name}</span>
              <span className="font-mono">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MemberCard({ member }: { member: any }) {
  return (
    <div className="rounded-xl border border-border/60 p-3 text-xs space-y-1.5 bg-card shadow-sm">
      <div className="flex items-center justify-between">
        <span className="font-mono text-muted-foreground">{member.id}</span>
        {member.riskTier && (
          <Badge
            variant={member.riskTier === "high" ? "destructive" : "secondary"}
            className="text-[10px]"
          >
            {member.riskTier} &mdash; {member.riskScore?.toFixed(2)}
          </Badge>
        )}
      </div>
      {member.name && <p className="font-medium">{member.name}</p>}
      <p className="text-muted-foreground">
        {member.age}y {member.gender} &mdash; {member.state}
      </p>
      {member.chronicConditions && (
        <p className="text-muted-foreground">{member.chronicConditions}</p>
      )}
    </div>
  );
}
