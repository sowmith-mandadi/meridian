"use client";

import {
  Activity,
  MessageSquare,
  GitBranch,
  Users,
  MessageCircle,
  BarChart3,
  PanelRight,
  Plus,
  Trash2,
  Sparkles,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { SavedChat } from "@/lib/chat-store";

const SUGGESTED_PROMPTS = [
  "Find high-risk members with diabetes in TX and FL",
  "Show risk drivers for member M-1042",
  "Generate a bar chart of members by state",
  "Recommend outreach for member M-1042 with drivers: transportation, medication adherence",
];

const NAV_ITEMS = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/pipeline", label: "Pipeline", icon: GitBranch },
  { href: "/collaborate", label: "Governance Tracking", icon: Users },
  { href: "/feedback", label: "Feedback", icon: MessageCircle },
  { href: "/observe", label: "Observe", icon: BarChart3 },
  { href: "/codex", label: "Codex Story", icon: Sparkles },
];

interface ChatSidebarProps {
  onNewChat: () => void;
  onToggleExplain: () => void;
  showExplain: boolean;
  history: SavedChat[];
  activeChatId: string;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
}

export function ChatSidebar({
  onNewChat,
  onToggleExplain,
  showExplain,
  history,
  activeChatId,
  onSelectChat,
  onDeleteChat,
}: ChatSidebarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex h-full w-full flex-col bg-sidebar border-r border-sidebar-border overflow-hidden">
      {/* Brand header */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-sidebar-border shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
          <Activity className="h-4 w-4 text-primary" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-semibold text-sm tracking-tight truncate">Meridian</span>
          <span className="text-[10px] text-muted-foreground leading-none">Healthcare AI</span>
        </div>
        <Badge variant="secondary" className="ml-auto text-[10px] shrink-0 bg-primary/10 text-primary border-0">
          v2
        </Badge>
      </div>

      {/* New chat */}
      <div className="px-3 py-2.5 shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 border-dashed hover:border-primary/40 hover:bg-primary/5 transition-all duration-200"
          onClick={onNewChat}
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">New conversation</span>
        </Button>
      </div>

      <Separator className="shrink-0" />

      {/* Scrollable content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 py-2">
          {/* Chat history */}
          {history.length > 0 && (
            <div className="mb-3">
              <p className="px-1 text-[10px] font-medium uppercase text-muted-foreground tracking-wider mb-2">
                Recent chats
              </p>
              <div className="space-y-0.5">
                {history.slice(0, 20).map((chat) => (
                  <div
                    key={chat.id}
                    className={cn(
                      "group flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-all duration-150",
                      chat.id === activeChatId
                        ? "bg-primary/10 text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    onClick={() => onSelectChat(chat.id)}
                  >
                    <MessageSquare className="h-3 w-3 shrink-0" />
                    <span className="truncate flex-1">{chat.title}</span>
                    <button
                      className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 hover:text-destructive transition-all duration-150"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChat(chat.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <Separator className="my-3" />
            </div>
          )}

          {/* Suggested prompts */}
          <p className="px-1 text-[10px] font-medium uppercase text-muted-foreground tracking-wider mb-2">
            Suggested prompts
          </p>
          <div className="space-y-0.5">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                className="w-full text-left px-2 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-primary/5 rounded-lg transition-all duration-150 leading-snug"
                onClick={() => {
                  const event = new CustomEvent("meridian:prompt", {
                    detail: prompt,
                  });
                  window.dispatchEvent(event);
                }}
              >
                {prompt}
              </button>
            ))}
          </div>

          <Separator className="my-3" />

          {/* Navigation */}
          <p className="px-1 text-[10px] font-medium uppercase text-muted-foreground tracking-wider mb-2">
            Navigation
          </p>
          <div className="space-y-0.5">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-2 py-2 text-sm rounded-lg transition-all duration-150",
                  pathname === item.href
                    ? "bg-primary/10 text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </ScrollArea>

      <Separator className="shrink-0" />
      <div className="px-3 py-2 space-y-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-xs hover:bg-primary/5 transition-all duration-150"
          onClick={onToggleExplain}
        >
          <PanelRight className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {showExplain ? "Hide" : "Show"} Explain Panel
          </span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-xs hover:bg-primary/5 transition-all duration-150"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-3.5 w-3.5 shrink-0 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-3.5 w-3.5 shrink-0 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          <span className="truncate">Toggle theme</span>
        </Button>
      </div>
    </div>
  );
}
