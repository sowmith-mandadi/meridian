import type { UIMessage } from "ai";

export interface SavedChat {
  id: string;
  title: string;
  messages: UIMessage[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "meridian-chats";

function read(): SavedChat[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(chats: SavedChat[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

export function loadChats(): SavedChat[] {
  return read().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function loadChat(id: string): SavedChat | null {
  return read().find((c) => c.id === id) ?? null;
}

export function saveChat(chat: SavedChat) {
  const chats = read();
  const idx = chats.findIndex((c) => c.id === chat.id);
  if (idx >= 0) {
    chats[idx] = chat;
  } else {
    chats.push(chat);
  }
  write(chats);
}

export function deleteChat(id: string) {
  write(read().filter((c) => c.id !== id));
}

export function titleFromMessages(messages: UIMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New conversation";
  for (const part of first.parts ?? []) {
    if (part.type === "text" && part.text) {
      return part.text.slice(0, 60);
    }
  }
  return "New conversation";
}
