/**
 * Root page: loads conversations on mount, shows the sidebar + active chat.
 * Login is handled inline for dev; swap with real auth redirect in production.
 */
"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { ChatInterface } from "@/components/ChatInterface";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function HomePage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const setConversations = useStore((s) => s.setConversations);
  const activeId = useStore((s) => s.activeConversationId);
  const connectionStatus = useStore((s) => s.connectionStatus);

  useEffect(() => {
    api.auth
      .me()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (!authed) return;
    api.conversations.list().then(({ items }) => setConversations(items));
  }, [authed]);

  if (authed === null) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-400 text-sm">
        Loading…
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-50">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-80 space-y-4">
          <h1 className="text-xl font-semibold text-slate-800">Sign in to Hugo</h1>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={async () => {
              await api.auth.devLogin(email, "Dev User");
              setAuthed(true);
            }}
            disabled={!email}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-40 transition-colors"
          >
            Dev login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50">
      <ErrorBoundary>
        <ConversationSidebar />
      </ErrorBoundary>
      <main className="flex-1 flex flex-col overflow-hidden">
        {activeId ? (
          <ErrorBoundary>
            <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 bg-white text-xs text-slate-400">
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionStatus === "connected"
                    ? "bg-green-400"
                    : connectionStatus === "connecting"
                    ? "bg-yellow-400"
                    : "bg-red-400"
                }`}
              />
              {connectionStatus}
            </div>
            <ChatInterface conversationId={activeId} />
          </ErrorBoundary>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            Select or create a conversation to begin
          </div>
        )}
      </main>
    </div>
  );
}
