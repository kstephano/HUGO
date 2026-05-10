"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
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
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-500 bg-[rgba(3,7,18,0.75)] backdrop-blur-sm ${
        phase === "exit" ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center gap-4">
        <p className="text-4xl font-light text-amber-400 tracking-[0.55em] animate-splash-letter">
          H . U . G . O
        </p>
        <p className="text-[11px] font-light text-slate-500 uppercase tracking-[0.3em]">
          Helpful Universal Guidance Operator
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);

  const setUser = useStore((s) => s.setUser);
  const setConversations = useStore((s) => s.setConversations);
  const addConversation = useStore((s) => s.addConversation);
  const setActive = useStore((s) => s.setActiveConversation);
  const setMessages = useStore((s) => s.setMessages);
  const activeId = useStore((s) => s.activeConversationId);
  const connectionStatus = useStore((s) => s.connectionStatus);

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
        try {
          const { items: msgs } = await api.messages.list(items[0].id);
          setMessages(items[0].id, msgs);
        } catch {}
        return;
      }
    }
    const conv = await api.conversations.create();
    addConversation(conv);
    setActive(conv.id);
  }, [setConversations, addConversation, setActive, setMessages]);

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

  const onSwipeStart = (e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
  };

  const onSwipeEnd = (e: React.TouchEvent) => {
    if (swipeStartX.current === null || swipeStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    const dy = e.changedTouches[0].clientY - swipeStartY.current;
    swipeStartX.current = null;
    swipeStartY.current = null;
    // Only act on clearly horizontal swipes (at least 50px, more horizontal than vertical)
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx > 0) setMobileNavOpen(true);
    else setMobileNavOpen(false);
  };

  if (boot === "unauthenticated") {
    return <LoginPage onSuccess={handleLoginSuccess} />;
  }

  return (
    <>
      {splash !== "done" && <SplashScreen phase={splash} />}

      <div className="flex h-[100dvh] overflow-hidden">
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
              <ConversationSidebar
                onLogout={() => setBoot("unauthenticated")}
                mobileOpen={mobileNavOpen}
                onMobileClose={() => setMobileNavOpen(false)}
              />
            </ErrorBoundary>
            <main
              className="flex-1 flex flex-col overflow-hidden min-w-0"
              onTouchStart={onSwipeStart}
              onTouchEnd={onSwipeEnd}
            >
              {activeId && (
                <ErrorBoundary>
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-[rgb(var(--border))] bg-[rgba(5,9,22,0.7)] backdrop-blur-sm">
                    {/* Hamburger — mobile only */}
                    <button
                      onClick={() => setMobileNavOpen(true)}
                      className="md:hidden flex items-center justify-center w-7 h-7 -ml-1 text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] transition-colors"
                      aria-label="Open menu"
                    >
                      <Menu className="w-4 h-4" />
                    </button>
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
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
