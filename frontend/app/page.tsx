"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { ChatInterface } from "@/components/ChatInterface";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// ── Splash screen ─────────────────────────────────────────────────
type SplashPhase = "name" | "acronym" | "exit" | "done";

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
      {/* HUGO name */}
      <div
        className={`absolute flex flex-col items-center gap-2 transition-opacity duration-300 ${
          phase === "name" ? "opacity-100" : "opacity-0"
        }`}
      >
        <p
          className={`text-7xl font-bold text-white ${
            phase === "name" ? "animate-splash-letter" : ""
          }`}
          style={{ letterSpacing: "0.35em" }}
        >
          HUGO
        </p>
      </div>

      {/* Acronym */}
      <div
        className={`absolute flex flex-col items-center gap-3 transition-opacity duration-300 ${
          phase === "acronym" ? "opacity-100" : "opacity-0"
        }`}
      >
        <p
          className="text-2xl font-light text-amber-400"
          style={{ letterSpacing: "0.6em" }}
        >
          H · U · G · O
        </p>
        <p
          className="text-[11px] font-light text-slate-500 uppercase"
          style={{ letterSpacing: "0.25em" }}
        >
          Heuristic Universal Generative Oracle
        </p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
type BootState = "loading" | "ready" | "error";

export default function HomePage() {
  const [splash, setSplash] = useState<SplashPhase>("name");
  const [boot, setBoot] = useState<BootState>("loading");

  const setConversations = useStore((s) => s.setConversations);
  const addConversation = useStore((s) => s.addConversation);
  const setActive = useStore((s) => s.setActiveConversation);
  const activeId = useStore((s) => s.activeConversationId);
  const connectionStatus = useStore((s) => s.connectionStatus);

  // Splash timing (independent of boot)
  useEffect(() => {
    const timers = [
      setTimeout(() => setSplash("acronym"), 600),
      setTimeout(() => setSplash("exit"),    1200),
      setTimeout(() => setSplash("done"),    1700),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // Boot sequence (runs in parallel with splash)
  useEffect(() => {
    (async () => {
      try {
        await api.auth.me().catch(() => api.auth.guest());
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

  return (
    <>
      {/* Splash overlay — renders on top while active */}
      {splash !== "done" && <SplashScreen phase={splash} />}

      {/* App shell — mounts immediately so boot runs under the splash */}
      <div className="flex h-screen overflow-hidden bg-[rgb(var(--bg))]">
        {boot === "error" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
            <p className="text-sm font-medium text-[rgb(var(--fg))]">Unable to connect</p>
            <p className="text-xs text-[rgb(var(--muted))]">
              Check that the backend is running and refresh the page.
            </p>
          </div>
        ) : boot === "loading" ? (
          /* Skeleton while booting — hidden under splash most of the time */
          <div className="flex-1 flex items-center justify-center">
            <span className="text-xs text-[rgb(var(--muted))] tracking-widest uppercase animate-pulse">
              Initialising…
            </span>
          </div>
        ) : (
          <>
            <ErrorBoundary>
              <ConversationSidebar />
            </ErrorBoundary>
            <main className="flex-1 flex flex-col overflow-hidden">
              {activeId && (
                <ErrorBoundary>
                  {/* Status bar */}
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
