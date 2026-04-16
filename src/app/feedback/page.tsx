"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type FeedbackRow = {
  id: string;
  userRole: string;
  requestText: string;
  status: string;
  createdAt: string;
};

function statusBadge(status: string) {
  switch (status) {
    case "reviewed":
      return <Badge variant="secondary">reviewed</Badge>;
    case "incorporated":
      return (
        <Badge
          variant="outline"
          className="border-emerald-500/60 text-emerald-400"
        >
          incorporated
        </Badge>
      );
    default:
      return <Badge variant="default">new</Badge>;
  }
}

export default function FeedbackPage() {
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [requestText, setRequestText] = useState("");
  const [userRole, setUserRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/feedback");
      if (!res.ok) throw new Error("Failed to load feedback");
      const data = (await res.json()) as FeedbackRow[];
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load feedback");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!requestText.trim() || !userRole.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestText: requestText.trim(),
          userRole: userRole.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          typeof err?.error === "string" ? err.error : "Submit failed",
        );
      }
      setRequestText("");
      setUserRole("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col gap-8 p-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Feedback Requests
        </h1>
        <p className="mt-1 text-muted-foreground">
          Submit product feedback and review requests from your team. Entries
          are stored for triage and roadmap planning.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquarePlus className="size-4" aria-hidden />
            New request
          </CardTitle>
          <CardDescription>
            Describe what you need and your role so we can prioritize
            correctly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <label
                htmlFor="user-role"
                className="text-sm font-medium text-foreground"
              >
                Role
              </label>
              <input
                id="user-role"
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
                placeholder="e.g. care manager, analyst"
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="grid gap-2">
              <label
                htmlFor="request-text"
                className="text-sm font-medium text-foreground"
              >
                Request
              </label>
              <Textarea
                id="request-text"
                value={requestText}
                onChange={(e) => setRequestText(e.target.value)}
                placeholder="What would you like to see improved or added?"
                rows={4}
                className="min-h-[100px] resize-y"
              />
            </div>
            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit feedback"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All requests</CardTitle>
          <CardDescription>
            {loading
              ? "Loading…"
              : `${items.length} request${items.length === 1 ? "" : "s"}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto px-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Request</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[180px]">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!loading && items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-muted-foreground py-8 text-center"
                    >
                      No feedback yet.
                    </TableCell>
                  </TableRow>
                ) : null}
                {items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {row.id.slice(0, 8)}…
                    </TableCell>
                    <TableCell>{row.userRole}</TableCell>
                    <TableCell className="max-w-md">
                      <span className="line-clamp-3">{row.requestText}</span>
                    </TableCell>
                    <TableCell>{statusBadge(row.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
