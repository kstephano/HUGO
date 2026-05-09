/**
 * Zustand sliced store: conversations, messages, connection, streaming.
 * Each slice is a self-contained set of state + actions.
 */
import { create } from "zustand";
import type { Conversation, ConnectionStatus, Message, StreamingMessage } from "./types";

// ── Conversations slice ────────────────────────────────────────────────────────
interface ConversationsSlice {
  conversations: Conversation[];
  activeConversationId: string | null;
  setConversations: (convs: Conversation[]) => void;
  addConversation: (conv: Conversation) => void;
  removeConversation: (id: string) => void;
  setActiveConversation: (id: string | null) => void;
  updateConversationTitle: (id: string, title: string) => void;
}

// ── Messages slice ─────────────────────────────────────────────────────────────
interface MessagesSlice {
  messagesByConv: Record<string, Message[]>;
  setMessages: (convId: string, msgs: Message[]) => void;
  appendMessage: (msg: Message) => void;
}

// ── Connection slice ───────────────────────────────────────────────────────────
interface ConnectionSlice {
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (s: ConnectionStatus) => void;
}

// ── Streaming slice ────────────────────────────────────────────────────────────
interface StreamingSlice {
  streaming: StreamingMessage | null;
  appendStreamDelta: (convId: string, text: string) => void;
  appendThinkingDelta: (convId: string, text: string) => void;
  addToolUse: (convId: string, toolUseId: string, toolName: string) => void;
  setToolResult: (convId: string, toolUseId: string, result: string) => void;
  finalizeStreaming: () => void;
}

type StoreState = ConversationsSlice & MessagesSlice & ConnectionSlice & StreamingSlice;

export const useStore = create<StoreState>((set, get) => ({
  // Conversations
  conversations: [],
  activeConversationId: null,
  setConversations: (conversations) => set({ conversations }),
  addConversation: (conv) => set((s) => ({ conversations: [conv, ...s.conversations] })),
  removeConversation: (id) =>
    set((s) => ({ conversations: s.conversations.filter((c) => c.id !== id) })),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  updateConversationTitle: (id, title) =>
    set((s) => ({
      conversations: s.conversations.map((c) => c.id === id ? { ...c, title } : c),
    })),

  // Messages
  messagesByConv: {},
  setMessages: (convId, msgs) =>
    set((s) => ({ messagesByConv: { ...s.messagesByConv, [convId]: msgs } })),
  appendMessage: (msg) =>
    set((s) => {
      const prev = s.messagesByConv[msg.conversationId] ?? [];
      return { messagesByConv: { ...s.messagesByConv, [msg.conversationId]: [...prev, msg] } };
    }),

  // Connection
  connectionStatus: "disconnected",
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  // Streaming
  streaming: null,
  appendStreamDelta: (convId, text) =>
    set((s) => ({
      streaming: (s.streaming && !s.streaming.isComplete)
        ? { ...s.streaming, text: s.streaming.text + text }
        : { conversationId: convId, text, thinking: "", toolUses: [], isComplete: false },
    })),
  appendThinkingDelta: (convId, text) =>
    set((s) => ({
      streaming: (s.streaming && !s.streaming.isComplete)
        ? { ...s.streaming, thinking: s.streaming.thinking + text }
        : { conversationId: convId, text: "", thinking: text, toolUses: [], isComplete: false },
    })),
  addToolUse: (convId, toolUseId, toolName) =>
    set((s) => ({
      streaming: (s.streaming && !s.streaming.isComplete)
        ? { ...s.streaming, toolUses: [...s.streaming.toolUses, { toolUseId, toolName }] }
        : { conversationId: convId, text: "", thinking: "", toolUses: [{ toolUseId, toolName }], isComplete: false },
    })),
  setToolResult: (convId, toolUseId, result) =>
    set((s) => {
      if (!s.streaming) return {};
      const toolUses = s.streaming.toolUses.map((t) =>
        t.toolUseId === toolUseId ? { ...t, result } : t
      );
      return { streaming: { ...s.streaming, toolUses } };
    }),
  finalizeStreaming: () => set({ streaming: null }),
}));
