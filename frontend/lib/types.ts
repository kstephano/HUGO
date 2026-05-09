/** Shared TypeScript types matching backend schemas. */

export interface User {
  userId: string;
  email: string;
  displayName: string;
  rememberConversations: boolean;
}

export interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "tool";
  content: ContentBlock[] | string | null;
  toolCalls: Record<string, unknown> | null;
  status: "completed" | "cancelled" | "error";
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  createdAt: string;
}

export interface ContentBlock {
  type: "text" | "thinking" | "tool_use" | "tool_result";
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string;
}

// WebSocket frame types — field names match the backend's snake_case JSON output
export type WsFrame =
  | { type: "delta"; text: string }
  | { type: "thinking"; text: string }
  | { type: "tool_start"; tool_name: string; tool_use_id: string }
  | { type: "tool_result"; tool_use_id: string; content: string }
  | { type: "done"; message_id: string; input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_write_tokens: number }
  | { type: "error"; code: string; message: string }
  | { type: "rate_limited"; retry_after: number }
  | { type: "title"; title: string };

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

// Optimistic streaming state
export interface StreamingMessage {
  conversationId: string;
  text: string;
  thinking: string;
  toolUses: { toolUseId: string; toolName: string; result?: string }[];
  isComplete: boolean;
}
