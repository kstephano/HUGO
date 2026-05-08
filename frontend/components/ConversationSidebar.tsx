"use client";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
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
    <aside className="w-64 flex-shrink-0 bg-surface-900 text-slate-200 flex flex-col h-full">
      <div className="p-4 border-b border-slate-700">
        <h1 className="text-lg font-semibold tracking-tight">Hugo</h1>
      </div>
      <div className="p-3">
        <button
          onClick={handleNew}
          className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          + New conversation
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 space-y-1">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => handleSelect(conv.id)}
            className={clsx(
              "flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer group text-sm",
              activeId === conv.id
                ? "bg-slate-700 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            )}
          >
            <span className="truncate">{conv.title ?? "Untitled"}</span>
            <button
              onClick={(e) => handleDelete(e, conv.id)}
              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 ml-2 text-xs"
              aria-label="Delete conversation"
            >
              ✕
            </button>
          </div>
        ))}
      </nav>
    </aside>
  );
}
