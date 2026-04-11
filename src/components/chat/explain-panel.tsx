"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Info, Shield, AlertTriangle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ExplainPanelProps {
  toolResult: { toolName: string; result: any } | null;
}

export function ExplainPanel({ toolResult }: ExplainPanelProps) {
  if (!toolResult) {
    return (
      <div className="flex h-full flex-col border-l bg-card">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <Info className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Explainability</span>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-xs text-muted-foreground text-center">
            Ask a question to see detailed explanations, risk drivers, and recommendations here.
          </p>
        </div>
      </div>
    );
  }

  const { toolName, result } = toolResult;

  return (
    <div className="flex h-full flex-col border-l bg-card">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Info className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Explainability</span>
        <Badge variant="secondary" className="ml-auto text-[10px] font-mono">
          {toolName}
        </Badge>
      </div>
      <ScrollArea className="flex-1 p-4">
        <ExplainContent toolName={toolName} result={result} />
      </ScrollArea>
      <div className="border-t px-4 py-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Shield className="h-3 w-3" />
        Governed output — no raw PHI exposed
      </div>
    </div>
  );
}

function ExplainContent({ toolName, result }: { toolName: string; result: any }) {
  if (toolName === "identify_cohort" && result?.members) {
    const members = result.members.slice(0, 5);
    const sdohCounts = { transportation: 0, food: 0, housing: 0 };
    for (const m of result.members) {
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
            <CardTitle className="text-xs">Cohort Summary</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            <p>Total: <strong>{result.count}</strong> members</p>
            <p>States: {[...new Set(result.members.map((m: any) => m.state))].join(", ")}</p>
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

  if (toolName === "get_risk_drivers" && result?.drivers) {
    return (
      <div className="space-y-4">
        {result.member && <MemberCard member={result.member} />}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">Risk Drivers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={result.drivers}
                  layout="vertical"
                  margin={{ left: 90 }}
                >
                  <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 9 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={85} />
                  <Tooltip />
                  <Bar dataKey="score" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (toolName === "recommend_outreach" && result?.recommendations) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Outreach plan for <strong>{result.memberName}</strong>
        </p>
        {result.recommendations.map((r: any, i: number) => (
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

  return (
    <pre className="text-[10px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}

function MemberCard({ member }: { member: any }) {
  return (
    <div className="rounded-lg border p-2.5 text-xs space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-mono text-muted-foreground">{member.id}</span>
        <Badge
          variant={member.riskTier === "high" ? "destructive" : "secondary"}
          className="text-[10px]"
        >
          {member.riskTier} — {member.riskScore?.toFixed(2)}
        </Badge>
      </div>
      <p className="font-medium">{member.name}</p>
      <p className="text-muted-foreground">
        {member.age}y {member.gender} — {member.state}
      </p>
      {member.chronicConditions && (
        <p className="text-muted-foreground">{member.chronicConditions}</p>
      )}
    </div>
  );
}
