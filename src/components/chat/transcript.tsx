"use client";

import { useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, User, ChevronDown, ChevronRight, Wrench } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ToolResultRenderer } from "./tool-result-renderer";

interface ChatTranscriptProps {
  messages: UIMessage[];
  status: string;
}

export function ChatTranscript({ messages, status }: ChatTranscriptProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const isStreaming = status === "streaming" || status === "submitted";

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Bot className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold">What can I help you with?</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Ask about member cohorts, risk drivers, outreach recommendations,
            or explore population health data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 px-4">
      <div className="max-w-3xl mx-auto py-4 space-y-4">
        {messages.map((msg) => (
          <MessageRow key={msg.id} message={msg} />
        ))}
        {isStreaming && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <div className="flex gap-1">
              <span className="animate-bounce [animation-delay:0ms] h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              <span className="animate-bounce [animation-delay:150ms] h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              <span className="animate-bounce [animation-delay:300ms] h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            </div>
            Thinking...
          </div>
        )}
        <div ref={endRef} />
      </div>
    </ScrollArea>
  );
}

function MessageRow({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : ""}`}>
      {!isUser && (
        <div className="flex-shrink-0 mt-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
        </div>
      )}
      <div className={`space-y-2 ${isUser ? "max-w-[80%]" : "flex-1 min-w-0"}`}>
        {message.parts?.map((part, i) => (
          <PartRenderer key={i} part={part} isUser={isUser} />
        ))}
      </div>
      {isUser && (
        <div className="flex-shrink-0 mt-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
            <User className="h-4 w-4" />
          </div>
        </div>
      )}
    </div>
  );
}

function PartRenderer({ part, isUser }: { part: any; isUser: boolean }) {
  const [collapsed, setCollapsed] = useState(true);

  if (part.type === "text") {
    if (!part.text) return null;
    return (
      <div
        className={`text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5"
            : "prose prose-sm prose-invert max-w-none"
        }`}
      >
        {isUser ? (
          part.text
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
        )}
      </div>
    );
  }

  if (part.type.startsWith("tool-")) {
    const toolName = part.type.replace("tool-", "");
    const hasResult = "result" in part && part.result;

    return (
      <Card className="border-dashed">
        <button
          className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
          onClick={() => setCollapsed((v) => !v)}
        >
          <Wrench className="h-3 w-3 text-muted-foreground" />
          <Badge variant="secondary" className="text-[10px] font-mono">
            {toolName}
          </Badge>
          {hasResult ? (
            <span className="text-muted-foreground ml-auto flex items-center gap-1">
              {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </span>
          ) : (
            <Skeleton className="ml-auto h-3 w-16" />
          )}
        </button>
        {!collapsed && hasResult && (
          <CardContent className="px-3 pb-3 pt-0">
            <ToolResultRenderer toolName={toolName} result={part.result} />
          </CardContent>
        )}
      </Card>
    );
  }

  return null;
}
