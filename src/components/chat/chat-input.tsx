"use client";

import { useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

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
    <div className="border-t px-4 py-3">
      <div className="max-w-3xl mx-auto flex gap-2">
        <Textarea
          ref={ref}
          placeholder="Ask about cohorts, risk drivers, outreach..."
          className="min-h-[44px] max-h-[120px] resize-none text-sm"
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          rows={1}
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={isStreaming}
          className="flex-shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
