"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ChatSidebar } from "@/components/chat/sidebar";
import { ChatTranscript } from "@/components/chat/transcript";
import { ExplainPanel } from "@/components/chat/explain-panel";
import { ChatInput } from "@/components/chat/chat-input";
import {
  loadChats,
  loadChat,
  saveChat,
  deleteChat,
  titleFromMessages,
  type SavedChat,
} from "@/lib/chat-store";

function newId() {
  return crypto.randomUUID();
}

export default function ChatPage() {
  const [chatId, setChatId] = useState(() => newId());
  const [history, setHistory] = useState<SavedChat[]>([]);
  const [showExplain, setShowExplain] = useState(true);
  const initialized = useRef(false);

  const chat = useChat({ id: chatId });
  const messages = chat.messages ?? [];
  const status = chat.status ?? "ready";

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      setHistory(loadChats());
    }
  }, []);

  // Restore messages when switching chat
  const switchChat = useCallback(
    (id: string) => {
      const saved = loadChat(id);
      if (saved) {
        setChatId(id);
        chat.setMessages(saved.messages);
      }
    },
    [chat]
  );

  // Persist on every message change (debounced via effect)
  useEffect(() => {
    if (messages.length === 0) return;
    const entry: SavedChat = {
      id: chatId,
      title: titleFromMessages(messages),
      messages,
      createdAt:
        loadChat(chatId)?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveChat(entry);
    setHistory(loadChats());
  }, [messages, chatId]);

  const handleNewChat = useCallback(() => {
    const id = newId();
    setChatId(id);
    chat.setMessages([]);
  }, [chat]);

  const handleDeleteChat = useCallback(
    (id: string) => {
      deleteChat(id);
      setHistory(loadChats());
      if (id === chatId) {
        handleNewChat();
      }
    },
    [chatId, handleNewChat]
  );

  const lastToolResult = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg?.role === "assistant" && Array.isArray(msg.parts)) {
        for (const part of msg.parts) {
          if (
            part?.type?.startsWith("tool-") &&
            "result" in part &&
            part.result != null
          ) {
            return {
              toolName: part.type.replace("tool-", ""),
              result: part.result,
            };
          }
        }
      }
    }
    return null;
  }, [messages]);

  function handleSend(text: string) {
    if (!text.trim()) return;
    chat.sendMessage({ text });
  }

  return (
    <div className="h-screen w-screen overflow-hidden">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize={15} minSize="200px" maxSize="260px">
          <div className="h-full overflow-hidden">
            <ChatSidebar
              onNewChat={handleNewChat}
              onToggleExplain={() => setShowExplain((v) => !v)}
              showExplain={showExplain}
              history={history}
              activeChatId={chatId}
              onSelectChat={switchChat}
              onDeleteChat={handleDeleteChat}
            />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={showExplain ? 55 : 80} minSize="400px">
          <div className="flex h-full flex-col overflow-hidden">
            <ChatTranscript messages={messages} status={status} />
            <ChatInput
              onSend={handleSend}
              isStreaming={status === "streaming" || status === "submitted"}
            />
          </div>
        </ResizablePanel>
        {showExplain && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={18} minSize="220px" maxSize="300px">
              <div className="h-full overflow-hidden">
                <ExplainPanel toolResult={lastToolResult} />
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}
