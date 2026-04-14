"use client";

import { useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";

interface ChatInputProps {
  onSend: (text: string) => void;
  isStreaming: boolean;
}

export function ChatInput({ onSend, isStreaming }: ChatInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    function handlePrompt(e: Event) {
      const text = (e as CustomEvent).detail;
      if (typeof text === "string" && text.trim()) {
        onSend(text);
      }
    }
    window.addEventListener("meridian:prompt", handlePrompt);
    return () => window.removeEventListener("meridian:prompt", handlePrompt);
  }, [onSend]);

  function handleSubmit() {
    const text = ref.current?.value?.trim();
    if (!text || isStreaming) return;
    onSend(text);
    if (ref.current) ref.current.value = "";
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="border-t bg-background/80 glass px-4 py-3">
      <div className="max-w-3xl mx-auto">
        <div className="flex gap-2 items-end rounded-2xl border border-border/60 bg-card px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40 transition-all duration-200">
          <Textarea
            ref={ref}
            placeholder="Ask about cohorts, risk drivers, outreach..."
            className="min-h-[40px] max-h-[120px] resize-none text-sm border-0 shadow-none focus-visible:ring-0 p-0 bg-transparent placeholder:text-muted-foreground/60"
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            rows={1}
          />
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={isStreaming}
            className="flex-shrink-0 h-8 w-8 rounded-xl bg-primary hover:bg-primary/90 shadow-sm shadow-primary/20 transition-all duration-200 disabled:opacity-40"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/50 text-center mt-1.5">
          Meridian can make mistakes. Verify important healthcare data.
        </p>
      </div>
    </div>
  );
}
