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
import { MessageSquare } from "lucide-react";

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
      <div className="flex items-center justify-center h-screen bg-[rgb(var(--bg))]">
        <div className="flex items-center gap-2 text-[rgb(var(--muted))] text-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--muted))] animate-pulse" />
          Loading…
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex items-center justify-center h-screen bg-[rgb(var(--bg))]">
        <div className="w-80 space-y-5">
          {/* Dev badge */}
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold tracking-wide uppercase">
              Dev mode
            </span>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[rgb(var(--fg))]">Sign in to Hugo</h1>
            <p className="text-xs text-[rgb(var(--muted))] mt-0.5">Development login — no password required</p>
          </div>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && email) {
                api.auth.devLogin(email, "Dev User").then(() => setAuthed(true));
              }
            }}
            className="w-full border border-[rgb(var(--border))] bg-[rgb(var(--input-bg))] text-[rgb(var(--fg))] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-[rgb(var(--muted))] transition"
          />
          <button
            onClick={async () => {
              await api.auth.devLogin(email, "Dev User");
              setAuthed(true);
            }}
            disabled={!email}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[rgb(var(--bg))]">
      <ErrorBoundary>
        <ConversationSidebar />
      </ErrorBoundary>
      <main className="flex-1 flex flex-col overflow-hidden">
        {activeId ? (
          <ErrorBoundary>
            {/* Status bar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[rgb(var(--border))] bg-[rgb(var(--input-bg))]">
              <span
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  connectionStatus === "connected"
                    ? "bg-emerald-400"
                    : connectionStatus === "connecting"
                    ? "bg-amber-400 animate-pulse"
                    : "bg-red-400"
                }`}
              />
              <span className="text-[11px] text-[rgb(var(--muted))] tracking-wide">
                {connectionStatus}
              </span>
            </div>
            <ChatInterface conversationId={activeId} />
          </ErrorBoundary>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[rgb(var(--muted))]">
            <MessageSquare className="w-8 h-8 opacity-30" />
            <p className="text-sm">Select a conversation or start a new one</p>
          </div>
        )}
      </main>
    </div>
  );
}
