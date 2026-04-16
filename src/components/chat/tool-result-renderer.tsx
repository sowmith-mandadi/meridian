"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

interface ToolResultRendererProps {
  toolName: string;
  result: any;
}

export function ToolResultRenderer({ toolName, result }: ToolResultRendererProps) {
  if (result?.error) {
    return <p className="text-sm text-destructive">{result.error}</p>;
  }

  switch (toolName) {
    case "identify_cohort":
      return <CohortResult data={result} />;
    case "get_risk_drivers":
      return <DriversResult data={result} />;
    case "explain_member":
      return <ExplainResult data={result} />;
    case "recommend_outreach":
      return <OutreachResult data={result} />;
    case "generate_chart":
      return <ChartResult data={result} />;
    case "submit_feedback":
      return (
        <p className="text-sm text-muted-foreground">
          Feedback submitted (ID: {result.id})
        </p>
      );
    default:
      return (
        <pre className="text-xs overflow-x-auto whitespace-pre-wrap font-mono text-muted-foreground">
          {JSON.stringify(result, null, 2)}
        </pre>
      );
  }
}

function CohortResult({ data }: { data: any }) {
  const members = data?.members?.slice(0, 10) ?? [];
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Found <strong>{data?.count ?? 0}</strong> members
      </p>
      {members.length > 0 && (
        <div className="rounded border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">ID</TableHead>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">State</TableHead>
                <TableHead className="text-xs">Risk</TableHead>
                <TableHead className="text-xs">Conditions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs font-mono">{m.id}</TableCell>
                  <TableCell className="text-xs">{m.name}</TableCell>
                  <TableCell className="text-xs">{m.state}</TableCell>
                  <TableCell className="text-xs">
                    <Badge
                      variant={m.riskTier === "high" ? "destructive" : "secondary"}
                      className="text-[10px]"
                    >
                      {m.riskScore?.toFixed(2)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">
                    {m.chronicConditions}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function DriversResult({ data }: { data: any }) {
  const drivers = data?.drivers ?? [];
  return (
    <div className="space-y-2">
      {data?.member && (
        <p className="text-xs text-muted-foreground">
          Drivers for <strong>{data.member.name}</strong> ({data.member.id})
        </p>
      )}
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={drivers}
            layout="vertical"
            margin={{ left: 90, right: 10, top: 5, bottom: 5 }}
          >
            <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 10 }} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 10 }}
              width={85}
            />
            <Tooltip />
            <Bar dataKey="score" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ExplainResult({ data }: { data: any }) {
  const sections = data?.sections;
  if (!sections) return null;
  return (
    <div className="space-y-2 text-xs">
      {sections.overview && (
        <p className="text-muted-foreground">{sections.overview.summary}</p>
      )}
      {sections.sdoh && (
        <div className="flex flex-wrap gap-1">
          {sections.sdoh.transportationBarrier && (
            <Badge variant="outline" className="text-[10px]">Transportation barrier</Badge>
          )}
          {sections.sdoh.foodInsecurity && (
            <Badge variant="outline" className="text-[10px]">Food insecurity</Badge>
          )}
          {sections.sdoh.housingInstability && (
            <Badge variant="outline" className="text-[10px]">Housing instability</Badge>
          )}
        </div>
      )}
    </div>
  );
}

function OutreachResult({ data }: { data: any }) {
  const recs = data?.recommendations ?? [];
  return (
    <div className="space-y-1.5">
      {recs.map((r: any, i: number) => (
        <div key={i} className="flex items-start gap-2 text-xs">
          <Badge
            variant={r.priority === "high" ? "destructive" : "secondary"}
            className="text-[10px] mt-0.5 flex-shrink-0"
          >
            {r.priority}
          </Badge>
          <div>
            <p className="font-medium">{r.action}</p>
            <p className="text-muted-foreground">{r.rationale}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChartResult({ data }: { data: any }) {
  const items = data?.data ?? [];
  const chartType = data?.type ?? "bar";

  if (chartType === "pie") {
    return (
      <div className="space-y-1">
        <p className="text-xs font-medium">{data?.title}</p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={items}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={70}
                label={({ name, value }) => `${name}: ${value}`}
              >
                {items.map((_: any, i: number) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium">{data?.title}</p>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={items} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
