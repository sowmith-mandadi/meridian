"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ChatSidebar } from "@/components/chat/sidebar";
import { ChatTranscript } from "@/components/chat/transcript";
import { ExplainPanel } from "@/components/chat/explain-panel";
import { ChatInput } from "@/components/chat/chat-input";

export default function ChatPage() {
  const { messages, sendMessage, status, setMessages } = useChat();
  const [showExplain, setShowExplain] = useState(true);

  const lastToolResult = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === "assistant" && msg.parts) {
        for (const part of msg.parts) {
          if (
            part.type.startsWith("tool-") &&
            "result" in part &&
            part.result
          ) {
            return { toolName: part.type.replace("tool-", ""), result: part.result };
          }
        }
      }
    }
    return null;
  })();

  return (
    <div className="flex h-screen">
      <ResizablePanelGroup orientation="horizontal" className="h-full">
        <ResizablePanel defaultSize={18} minSize={14} maxSize={28}>
          <ChatSidebar
            onNewChat={() => setMessages([])}
            onToggleExplain={() => setShowExplain((v) => !v)}
            showExplain={showExplain}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={showExplain ? 56 : 82} minSize={40}>
          <div className="flex h-full flex-col">
            <ChatTranscript messages={messages} status={status} />
            <ChatInput
              onSend={(text: string) => sendMessage({ text })}
              isStreaming={status === "streaming" || status === "submitted"}
            />
          </div>
        </ResizablePanel>
        {showExplain && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={26} minSize={20} maxSize={40}>
              <ExplainPanel toolResult={lastToolResult} />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}
