"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Plus, Trash2, Bot, ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";

function AstronautLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`relative flex-shrink-0 ${className}`}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-500 via-slate-600 to-slate-800 shadow-[0_0_14px_rgba(245,158,11,0.35)]" />
      <div className="absolute inset-[2px] rounded-full bg-gradient-to-b from-amber-400/25 via-sky-900/30 to-slate-900/80" />
      <div className="absolute top-[3px] left-[4px] w-[35%] h-[25%] rounded-full bg-white/20 blur-[1px]" />
      <Bot className="absolute inset-0 p-[5px] text-amber-300" />
    </div>
  );
}

export function ConversationSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  const conversations = useStore((s) => s.conversations);
  const activeId = useStore((s) => s.activeConversationId);
  const setActive = useStore((s) => s.setActiveConversation);
  const addConversation = useStore((s) => s.addConversation);
  const removeConversation = useStore((s) => s.removeConversation);
  const setMessages = useStore((s) => s.setMessages);

  const handleNew = async () => {
    try {
      const conv = await api.conversations.create();
      addConversation(conv);
      setActive(conv.id);
    } catch (e) {
      console.error("create_conversation_error", e);
    }
  };

  const handleSelect = async (id: string) => {
    setActive(id);
    try {
      const { items } = await api.messages.list(id);
      setMessages(id, items);
    } catch (e) {
      console.error("load_messages_error", e);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await api.conversations.delete(id);
    removeConversation(id);
    if (activeId === id) setActive(null);
  };

  return (
    <aside
      className={clsx(
        "flex-shrink-0 flex flex-col h-full bg-[rgb(var(--sidebar-bg))] border-r border-[rgb(var(--sidebar-border))]",
        "transition-[width] duration-300 ease-in-out overflow-hidden",
        collapsed ? "w-14" : "w-60"
      )}
    >
      {/* Header: logo + collapse toggle */}
      <div className="flex items-center border-b border-[rgb(var(--sidebar-border))] flex-shrink-0">
        {/* Logo area — always visible */}
        <div
          className={clsx(
            "flex items-center gap-3 py-4 transition-all duration-300 min-w-0",
            collapsed ? "px-[11px]" : "px-4 flex-1"
          )}
        >
          <AstronautLogo className="w-9 h-9 flex-shrink-0" />
          {!collapsed && (
            <div className="min-w-0 overflow-hidden">
              <p className="text-[rgb(var(--sidebar-fg))] font-semibold tracking-[0.15em] text-sm leading-none whitespace-nowrap">
                HUGO
              </p>
              <p className="text-[9px] text-[rgb(var(--muted))] tracking-[0.2em] uppercase mt-0.5 whitespace-nowrap">
                H · U · G · O
              </p>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={clsx(
            "flex-shrink-0 flex items-center justify-center text-[rgb(var(--muted))] hover:text-[rgb(var(--sidebar-fg))] transition-colors",
            collapsed ? "w-14 h-[61px]" : "w-8 h-[61px] mr-1"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" />
            : <ChevronLeft className="w-4 h-4" />
          }
        </button>
      </div>

      {/* New conversation */}
      <div className={clsx("flex-shrink-0", collapsed ? "p-2" : "p-3")}>
        {collapsed ? (
          <button
            onClick={handleNew}
            className="w-10 h-10 mx-auto flex items-center justify-center rounded-lg
              bg-gradient-to-br from-amber-600 to-amber-700
              hover:from-amber-500 hover:to-amber-600
              text-white transition-all
              shadow-[0_0_12px_rgba(245,158,11,0.2)]
              hover:shadow-[0_0_16px_rgba(245,158,11,0.35)]"
            aria-label="New conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleNew}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg
              bg-gradient-to-r from-amber-600 to-amber-700
              hover:from-amber-500 hover:to-amber-600
              text-white text-sm font-medium tracking-wide
              transition-all shadow-[0_0_16px_rgba(245,158,11,0.2)]
              hover:shadow-[0_0_20px_rgba(245,158,11,0.35)]"
          >
            <Plus className="w-4 h-4" />
            New chat
          </button>
        )}
      </div>

      {/* Conversation list — hidden when collapsed */}
      {!collapsed && (
        <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2 space-y-0.5">
          {conversations.length === 0 && (
            <p className="text-center text-[10px] text-[rgb(var(--muted))] mt-8 px-3 leading-relaxed">
              No conversations yet
            </p>
          )}
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => handleSelect(conv.id)}
              className={clsx(
                "group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-all",
                activeId === conv.id
                  ? "bg-amber-500/10 text-amber-300 border border-amber-500/20 shadow-[inset_0_0_12px_rgba(245,158,11,0.05)]"
                  : "text-[rgb(var(--muted))] hover:bg-white/5 hover:text-[rgb(var(--sidebar-fg))] border border-transparent"
              )}
            >
              <span className="truncate leading-snug">{conv.title ?? "New conversation"}</span>
              <button
                onClick={(e) => handleDelete(e, conv.id)}
                className="opacity-0 group-hover:opacity-100 ml-2 flex-shrink-0 text-[rgb(var(--muted))] hover:text-red-400 transition-all"
                aria-label="Delete conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </nav>
      )}

      {/* Collapsed: show active conversation indicator dots */}
      {collapsed && conversations.length > 0 && (
        <div className="flex-1 flex flex-col items-center pt-2 gap-1.5 overflow-hidden">
          {conversations.slice(0, 8).map((conv) => (
            <button
              key={conv.id}
              onClick={() => handleSelect(conv.id)}
              title={conv.title ?? "New conversation"}
              className={clsx(
                "w-2 h-2 rounded-full transition-all flex-shrink-0",
                activeId === conv.id
                  ? "bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]"
                  : "bg-[rgb(var(--border))] hover:bg-[rgb(var(--muted))]"
              )}
            />
          ))}
        </div>
      )}
    </aside>
  );
}
