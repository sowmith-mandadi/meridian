"use client";

import { Activity, MessageSquare, GitBranch, Users, MessageCircle, BarChart3, PanelRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SUGGESTED_PROMPTS = [
  "Find high-risk diabetic members in TX and FL",
  "Show risk drivers for transportation barriers",
  "Generate a chart of members by risk tier",
  "Recommend outreach for medication non-adherence",
];

const NAV_ITEMS = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/pipeline", label: "Pipeline", icon: GitBranch },
  { href: "/collaborate", label: "Collaborate", icon: Users },
  { href: "/feedback", label: "Feedback", icon: MessageCircle },
  { href: "/observe", label: "Observe", icon: BarChart3 },
];

interface ChatSidebarProps {
  onNewChat: () => void;
  onToggleExplain: () => void;
  showExplain: boolean;
}

export function ChatSidebar({ onNewChat, onToggleExplain, showExplain }: ChatSidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-card border-r">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Activity className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm">Meridian</span>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          AI
        </Badge>
      </div>

      <div className="px-3 py-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={onNewChat}
        >
          <Plus className="h-3.5 w-3.5" />
          New conversation
        </Button>
      </div>

      <Separator />

      <ScrollArea className="flex-1 px-2 py-2">
        <div className="mb-3">
          <p className="px-2 text-[10px] font-medium uppercase text-muted-foreground tracking-wider mb-1">
            Suggested prompts
          </p>
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
              onClick={() => {
                /* handled by parent via custom event */
                const event = new CustomEvent("meridian:prompt", { detail: prompt });
                window.dispatchEvent(event);
              }}
            >
              {prompt}
            </button>
          ))}
        </div>

        <Separator className="my-2" />

        <p className="px-2 text-[10px] font-medium uppercase text-muted-foreground tracking-wider mb-1">
          Navigation
        </p>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 text-xs rounded transition-colors",
              pathname === item.href
                ? "bg-muted text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        ))}
      </ScrollArea>

      <Separator />
      <div className="px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-xs"
          onClick={onToggleExplain}
        >
          <PanelRight className="h-3.5 w-3.5" />
          {showExplain ? "Hide" : "Show"} Explain Panel
        </Button>
      </div>
    </div>
  );
}
