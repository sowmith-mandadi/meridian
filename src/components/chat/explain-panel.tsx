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

const CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

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
    <div className="flex h-full flex-col border-l bg-card">
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <Info className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Explainability</span>
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
              {/* Latest result gets full treatment */}
              {toolResult && (
                <ExplainContent
                  toolName={toolResult.toolName}
                  result={toolResult.result}
                />
              )}

              {/* Previous results as collapsed summaries */}
              {allResults.length > 1 && (
                <>
                  <Separator />
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Earlier results ({allResults.length - 1})
                  </p>
                  {allResults.slice(0, -1).reverse().map((tr, i) => (
                    <PreviousResultCard key={i} toolName={tr.toolName} result={tr.result} />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      <div className="border-t px-4 py-2 flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
        <Shield className="h-3 w-3" />
        Governed output — no raw PHI exposed
      </div>
    </div>
  );
}

function DefaultOverview() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5" />
            Dataset Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Members</span>
            <span className="font-mono">500</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">States</span>
            <span className="font-mono">TX, FL, CA, NY</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Risk tiers</span>
            <span className="font-mono">high / medium / low</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total records</span>
            <span className="font-mono">~4,700</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Data Sources
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-1">
          {[
            { name: "Claims", desc: "ICD-10, CPT, amounts, providers" },
            { name: "Pharmacy", desc: "Drug names, adherence %, fill dates" },
            { name: "SDOH", desc: "Transportation, food, housing flags" },
            { name: "Call Center", desc: "Reason, sentiment, dates" },
          ].map((s) => (
            <div key={s.name} className="flex items-start gap-2">
              <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5">
                {s.name}
              </Badge>
              <span className="text-muted-foreground">{s.desc}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center px-2">
        Ask a question to see risk drivers, member explanations, and outreach recommendations here.
      </p>
    </div>
  );
}

function PreviousResultCard({ toolName, result }: { toolName: string; result: any }) {
  const summary = getResultSummary(toolName, result);
  return (
    <div className="rounded-lg border p-2.5 text-xs space-y-0.5">
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
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
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

      <Card>
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
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {members.length > 0 && (
        <Card>
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
      <Card>
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
                <Bar dataKey="score" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      {result?.avgAdherencePct != null && (
        <div className="text-xs text-muted-foreground">
          Avg medication adherence: <span className="font-mono font-medium">{result.avgAdherencePct.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

function OutreachExplain({ result }: { result: any }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Outreach plan for <strong>{result?.memberName ?? "member"}</strong>
      </p>
      {(result?.recommendations ?? []).map((r: any, i: number) => (
        <Card key={i}>
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
        <Card>
          <CardContent className="pt-3 text-xs text-muted-foreground">
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
        <Card>
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
        <Card>
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
        <Card>
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
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
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
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
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
    <div className="rounded-lg border p-2.5 text-xs space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-mono text-muted-foreground">{member.id}</span>
        {member.riskTier && (
          <Badge
            variant={member.riskTier === "high" ? "destructive" : "secondary"}
            className="text-[10px]"
          >
            {member.riskTier} — {member.riskScore?.toFixed(2)}
          </Badge>
        )}
      </div>
      {member.name && <p className="font-medium">{member.name}</p>}
      <p className="text-muted-foreground">
        {member.age}y {member.gender} — {member.state}
      </p>
      {member.chronicConditions && (
        <p className="text-muted-foreground">{member.chronicConditions}</p>
      )}
    </div>
  );
}
