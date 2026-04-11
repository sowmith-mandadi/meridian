"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";

const DEMO_ACCOUNTS = [
  { email: "care_manager@demo.com", label: "Care Manager", role: "care_manager" },
  { email: "analyst@demo.com", label: "Analyst", role: "analyst" },
  { email: "admin@demo.com", label: "Admin", role: "admin" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid credentials");
    } else {
      router.push("/chat");
    }
  }

  async function quickLogin(demoEmail: string) {
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      email: demoEmail,
      password: "demo123",
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Login failed");
    } else {
      router.push("/chat");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Activity className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Meridian</CardTitle>
          <p className="text-sm text-muted-foreground">
            Healthcare Intelligence Platform
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Quick demo access
              </span>
            </div>
          </div>

          <div className="grid gap-2">
            {DEMO_ACCOUNTS.map((acct) => (
              <Button
                key={acct.email}
                variant="outline"
                className="w-full justify-start"
                onClick={() => quickLogin(acct.email)}
                disabled={loading}
              >
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px] font-bold uppercase">
                  {acct.role[0]}
                </span>
                {acct.label}
                <span className="ml-auto text-xs text-muted-foreground">
                  {acct.email}
                </span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
