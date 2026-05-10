/** Typed REST API client — thin wrappers around fetch with error handling. */
import type { Conversation, Message, User } from "./types";

const BASE = "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`${resp.status} ${resp.statusText}: ${body}`);
  }
  return resp.json() as Promise<T>;
}

export const api = {
  auth: {
    google: (credential: string) =>
      request<User>("/api/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential }),
      }),
    devLogin: (email: string, displayName: string) =>
      request<User>("/api/auth/dev-login", {
        method: "POST",
        body: JSON.stringify({ email, display_name: displayName }),
      }),
    register: (email: string, displayName: string, password: string) =>
      request<User>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, displayName, password }),
      }),
    emailLogin: (email: string, password: string) =>
      request<User>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    me: () => request<User>("/api/auth/me"),
    logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
    wsTicket: () => request<{ ticket: string }>("/api/auth/ws-ticket"),
    settings: (rememberConversations: boolean) =>
      request<User>("/api/auth/settings", {
        method: "PATCH",
        body: JSON.stringify({ remember_conversations: rememberConversations }),
      }),
  },

  conversations: {
    list: (limit = 20, offset = 0) =>
      request<{ items: Conversation[]; total: number }>(`/api/conversations?limit=${limit}&offset=${offset}`),
    create: (title?: string) =>
      request<Conversation>("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ title: title ?? null }),
      }),
    get: (id: string) => request<Conversation>(`/api/conversations/${id}`),
    delete: (id: string) =>
      fetch(`${BASE}/api/conversations/${id}`, { method: "DELETE", credentials: "include" }),
    deleteAll: () =>
      fetch(`${BASE}/api/conversations`, { method: "DELETE", credentials: "include" }),
  },

  messages: {
    list: (conversationId: string, limit = 50, offset = 0) =>
      request<{ items: Message[]; total: number }>(
        `/api/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}`
      ),
  },
};
