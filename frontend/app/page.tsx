/**
 * Root page: auto-creates a guest session on first visit, then drops the user
 * straight into a conversation — no sign-in required.
 */
"use client";
import { useEffect, useState } from "react";
import { Bot } from "lucide-react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { ChatInterface } from "@/components/ChatInterface";
import { ErrorBoundary } from "@/components/ErrorBoundary";

type BootState = "loading" | "ready" | "error";

export default function HomePage() {
  const [boot, setBoot] = useState<BootState>("loading");
  const setConversations = useStore((s) => s.setConversations);
  const addConversation = useStore((s) => s.addConversation);
  const setActive = useStore((s) => s.setActiveConversation);
  const activeId = useStore((s) => s.activeConversationId);
  const connectionStatus = useStore((s) => s.connectionStatus);

  useEffect(() => {
    (async () => {
      try {
        // Returning visitor — reuse existing session cookie
        await api.auth.me().catch(() => api.auth.guest());

        // Load conversations; auto-create one if this is a fresh guest
        const { items } = await api.conversations.list();
        if (items.length > 0) {
          setConversations(items);
          setActive(items[0].id);
        } else {
          const conv = await api.conversations.create();
          addConversation(conv);
          setActive(conv.id);
        }

        setBoot("ready");
      } catch {
        setBoot("error");
      }
    })();
  }, []);

  if (boot === "loading") {
    return (
      <div className="flex items-center justify-center h-screen bg-[rgb(var(--bg))]">
        <div className="flex items-center gap-3 text-[rgb(var(--muted))]">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center animate-pulse">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm">Starting Hugo…</span>
        </div>
      </div>
    );
  }

  if (boot === "error") {
    return (
      <div className="flex items-center justify-center h-screen bg-[rgb(var(--bg))]">
        <div className="text-center space-y-2">
          <p className="text-sm text-[rgb(var(--fg))] font-medium">Unable to connect</p>
          <p className="text-xs text-[rgb(var(--muted))]">Check that the backend is running and try refreshing.</p>
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
            {/* Connection status bar */}
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
        ) : null}
      </main>
    </div>
  );
}
