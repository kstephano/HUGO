"use client";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Plus, Trash2, Bot } from "lucide-react";
import clsx from "clsx";

export function ConversationSidebar() {
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
    <aside className="w-60 flex-shrink-0 flex flex-col h-full bg-[rgb(var(--sidebar-bg))] border-r border-[rgb(var(--sidebar-border))]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[rgb(var(--sidebar-border))]">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <span className="text-[rgb(var(--sidebar-fg))] font-semibold tracking-tight">Hugo</span>
      </div>

      {/* New conversation */}
      <div className="p-3">
        <button
          onClick={handleNew}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New chat
        </button>
      </div>

      {/* Conversation list */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2 space-y-0.5">
        {conversations.length === 0 && (
          <p className="text-center text-[10px] text-[rgb(var(--muted))] mt-6 px-3">
            No conversations yet
          </p>
        )}
        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => handleSelect(conv.id)}
            className={clsx(
              "group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors",
              activeId === conv.id
                ? "bg-white/10 text-white"
                : "text-[rgb(var(--muted))] hover:bg-white/5 hover:text-[rgb(var(--sidebar-fg))]"
            )}
          >
            <span className="truncate leading-snug">{conv.title ?? "New conversation"}</span>
            <button
              onClick={(e) => handleDelete(e, conv.id)}
              className="opacity-0 group-hover:opacity-100 ml-2 flex-shrink-0 text-[rgb(var(--muted))] hover:text-red-400 transition-opacity"
              aria-label="Delete conversation"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </nav>
    </aside>
  );
}
