"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { ChatInterface } from "@/components/ChatInterface";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoginPage } from "@/components/LoginPage";
import type { User } from "@/lib/types";

// ── Splash screen ─────────────────────────────────────────────────
type SplashPhase = "show" | "exit" | "done";

function SplashScreen({ phase }: { phase: SplashPhase }) {
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-500 ${
        phase === "exit" ? "opacity-0" : "opacity-100"
      }`}
      style={{
        background: "rgb(3 7 18)",
        backgroundImage: `
          radial-gradient(ellipse 90% 60% at 8% 92%, rgba(59,130,246,0.08) 0%, transparent 55%),
          radial-gradient(ellipse 70% 50% at 92% 8%,  rgba(245,158,11,0.07) 0%, transparent 55%),
          radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)
        `,
        backgroundSize: "100% 100%, 100% 100%, 64px 64px",
      }}
    >
      <div className="flex flex-col items-center gap-4">
        <p className="text-4xl font-light text-amber-400 tracking-[0.55em] animate-splash-letter">
          H . U . G . O
        </p>
        <p className="text-[11px] font-light text-slate-500 uppercase tracking-[0.3em]">
          Heuristic Universal Generative Oracle
        </p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
type BootState = "loading" | "ready" | "unauthenticated" | "error";

export default function HomePage() {
  const [splash, setSplash] = useState<SplashPhase>("show");
  const [boot, setBoot] = useState<BootState>("loading");

  const setUser = useStore((s) => s.setUser);
  const setConversations = useStore((s) => s.setConversations);
  const addConversation = useStore((s) => s.addConversation);
  const setActive = useStore((s) => s.setActiveConversation);
  const activeId = useStore((s) => s.activeConversationId);
  const connectionStatus = useStore((s) => s.connectionStatus);

  // Splash timing: show for 1.5s, fade over 0.5s, then unmount
  useEffect(() => {
    const timers = [
      setTimeout(() => setSplash("exit"), 1500),
      setTimeout(() => setSplash("done"), 2000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const loadConversations = useCallback(async (rememberConversations: boolean) => {
    if (rememberConversations) {
      const { items } = await api.conversations.list();
      if (items.length > 0) {
        setConversations(items);
        setActive(items[0].id);
        return;
      }
    }
    const conv = await api.conversations.create();
    addConversation(conv);
    setActive(conv.id);
  }, [setConversations, addConversation, setActive]);

  const handleLoginSuccess = useCallback(async (user: User) => {
    setUser(user);
    setBoot("loading");
    try {
      await loadConversations(user.rememberConversations);
      setBoot("ready");
    } catch {
      setBoot("error");
    }
  }, [setUser, loadConversations]);

  // Boot sequence: check if already logged in
  useEffect(() => {
    (async () => {
      try {
        const user = await api.auth.me();
        setUser(user);
        await loadConversations(user.rememberConversations);
        setBoot("ready");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg.startsWith("401")) {
          setBoot("unauthenticated");
        } else {
          setBoot("error");
        }
      }
    })();
  }, []);

  if (boot === "unauthenticated") {
    return <LoginPage onSuccess={handleLoginSuccess} />;
  }

  return (
    <>
      {splash !== "done" && <SplashScreen phase={splash} />}

      <div className="flex h-screen overflow-hidden bg-[rgb(var(--bg))]">
        {boot === "error" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
            <p className="text-sm font-medium text-[rgb(var(--fg))]">Unable to connect</p>
            <p className="text-xs text-[rgb(var(--muted))]">
              Check that the backend is running and refresh the page.
            </p>
          </div>
        ) : boot === "loading" ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-xs text-[rgb(var(--muted))] tracking-widest uppercase animate-pulse">
              Initialising…
            </span>
          </div>
        ) : (
          <>
            <ErrorBoundary>
              <ConversationSidebar onLogout={() => setBoot("unauthenticated")} />
            </ErrorBoundary>
            <main className="flex-1 flex flex-col overflow-hidden">
              {activeId && (
                <ErrorBoundary>
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-[rgb(var(--border))] bg-[rgb(var(--input-bg))/60]">
                    <span
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        connectionStatus === "connected"
                          ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]"
                          : connectionStatus === "connecting"
                          ? "bg-amber-400 animate-pulse"
                          : "bg-red-500"
                      }`}
                    />
                    <span className="text-[11px] text-[rgb(var(--muted))] tracking-widest uppercase">
                      {connectionStatus}
                    </span>
                  </div>
                  <ChatInterface conversationId={activeId} />
                </ErrorBoundary>
              )}
            </main>
          </>
        )}
      </div>
    </>
  );
}
