"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Activity,
  MessageSquare,
  GitBranch,
  Users,
  MessageCircle,
  BarChart3,
  Sparkles,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/pipeline", label: "Pipeline", icon: GitBranch },
  { href: "/collaborate", label: "Governance Tracking", icon: Users },
  { href: "/feedback", label: "Feedback", icon: MessageCircle },
  { href: "/observe", label: "Observe", icon: BarChart3 },
  { href: "/codex", label: "Codex Story", icon: Sparkles },
];

export function AppNav() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/80 glass">
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-1 px-4">
        <Link
          href="/chat"
          className="flex items-center gap-2 mr-4 shrink-0"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold text-sm tracking-tight hidden sm:inline">
            Meridian
          </span>
        </Link>

        <div className="flex items-center gap-0.5 overflow-x-auto">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm whitespace-nowrap transition-all duration-150",
                pathname === item.href
                  ? "bg-primary/10 text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <item.icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden md:inline">{item.label}</span>
            </Link>
          ))}
        </div>

        <div className="ml-auto shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </div>
    </nav>
  );
}
