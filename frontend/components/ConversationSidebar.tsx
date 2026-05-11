"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import {
  Plus, Trash2, ChevronLeft, ChevronRight,
  Settings, LogOut, Trash, ToggleLeft, ToggleRight,
} from "lucide-react";
import clsx from "clsx";

const FADE_MS = 400;

interface Props {
  onLogout: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

// ── Confirmation dialog ────────────────────────────────────────────────────────
interface ConfirmDialogProps {
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  body: string;
  confirmLabel: string;
  confirmClass: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ icon, iconClass, title, body, confirmLabel, confirmClass, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Card */}
      <div className="relative w-full max-w-sm rounded-2xl border border-[rgb(var(--border))] bg-[rgba(7,12,30,0.97)] shadow-2xl px-6 py-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className={clsx("flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm", iconClass)}>
            {icon}
          </span>
          <p className="text-sm font-semibold text-[rgb(var(--fg))]">{title}</p>
        </div>
        <p className="text-xs text-[rgb(var(--muted))] leading-relaxed">{body}</p>
        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 rounded-lg text-xs text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={clsx("px-4 py-1.5 rounded-lg text-xs font-medium transition-all", confirmClass)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
export function ConversationSidebar({ onLogout, mobileOpen = false, onMobileClose }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fadingId, setFadingId] = useState<string | null>(null);
  const [pendingToggle, setPendingToggle] = useState<boolean | null>(null);
  const [clearAllPending, setClearAllPending] = useState(false);
  const [logoWobbling, setLogoWobbling] = useState(false);

  const handleLogoClick = () => {
    if (logoWobbling) return;
    setLogoWobbling(true);
    setTimeout(() => setLogoWobbling(false), 550);
  };
  const settingsRef = useRef<HTMLDivElement>(null);

  const conversations = useStore((s) => s.conversations);
  const activeId = useStore((s) => s.activeConversationId);
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const setActive = useStore((s) => s.setActiveConversation);
  const addConversation = useStore((s) => s.addConversation);
  const removeConversation = useStore((s) => s.removeConversation);
  const setConversations = useStore((s) => s.setConversations);
  const setMessages = useStore((s) => s.setMessages);
  const messagesByConv = useStore((s) => s.messagesByConv);
  const draftInput = useStore((s) => s.draftInput);

  // Close settings panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    if (settingsOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [settingsOpen]);

  const fadeAndRemove = (id: string, afterFade: () => void) => {
    setFadingId(id);
    setTimeout(() => {
      afterFade();
      setFadingId(null);
    }, FADE_MS);
  };

  const handleNew = async () => {
    const emptyConv = conversations.find((c) => !c.title && c.id !== fadingId);
    if (emptyConv) {
      setActive(emptyConv.id);
      onMobileClose?.();
      return;
    }
    try {
      const conv = await api.conversations.create();
      addConversation(conv);
      setActive(conv.id);
    } catch (e) {
      console.error("create_conversation_error", e);
    }
    onMobileClose?.();
  };

  const handleSelect = async (id: string) => {
    if (id === activeId) return;

    // Animate out the current conversation if it's empty and nothing is typed
    const currentConv = conversations.find((c) => c.id === activeId);
    if (currentConv && !currentConv.title && !draftInput.trim()) {
      const idToDelete = currentConv.id;
      fadeAndRemove(idToDelete, async () => {
        try { await api.conversations.delete(idToDelete); } catch {}
        removeConversation(idToDelete);
      });
    }

    setActive(id);
    onMobileClose?.();
    if (id in messagesByConv) return;
    try {
      const { items } = await api.messages.list(id);
      setMessages(id, items);
    } catch (e) {
      console.error("load_messages_error", e);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (activeId === id) setActive(null);
    fadeAndRemove(id, async () => {
      try { await api.conversations.delete(id); } catch {}
      removeConversation(id);
    });
  };

  const handleClearAll = async () => {
    await api.conversations.deleteAll();
    setConversations([]);
    setActive(null);
    setSettingsOpen(false);
    setClearAllPending(false);
  };

  const handleToggleClick = () => {
    if (!user) return;
    setPendingToggle(!user.rememberConversations);
  };

  const handleConfirmToggle = async () => {
    if (!user || pendingToggle === null) return;
    try {
      if (!pendingToggle) {
        // Turning off — wipe all history on the backend then clear locally
        await api.conversations.deleteAll();
        setConversations([]);
        setActive(null);
      }
      const updated = await api.auth.settings(pendingToggle);
      setUser(updated);
    } catch (e) {
      console.error("settings_update_error", e);
    }
    setPendingToggle(null);
    setSettingsOpen(false);
  };

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {}
    setUser(null);
    setConversations([]);
    setActive(null);
    onLogout();
  };

  return (
    <>
      {/* Confirmation dialog */}
      {pendingToggle !== null && (
        <ConfirmDialog
          icon={pendingToggle ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          iconClass={pendingToggle ? "bg-purple-500/15 text-purple-400" : "bg-amber-500/15 text-amber-400"}
          title={pendingToggle ? "Remember conversations?" : "Stop remembering conversations?"}
          body={pendingToggle
            ? "Hugo will save your conversation history across sessions. You'll be able to pick up right where you left off next time you log in."
            : "Hugo will stop saving new conversations. Your existing history will be cleared and won't be available after you leave."
          }
          confirmLabel={pendingToggle ? "Turn on" : "Turn off"}
          confirmClass={pendingToggle
            ? "bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_12px_rgba(147,51,234,0.35)]"
            : "bg-amber-600/80 hover:bg-amber-500/80 text-white"
          }
          onConfirm={handleConfirmToggle}
          onCancel={() => setPendingToggle(null)}
        />
      )}

      {clearAllPending && (
        <ConfirmDialog
          icon={<Trash className="w-4 h-4" />}
          iconClass="bg-red-500/15 text-red-400"
          title="Clear all conversations?"
          body="This will permanently delete your entire conversation history. This cannot be undone."
          confirmLabel="Clear all"
          confirmClass="bg-red-600/90 hover:bg-red-500 text-white"
          onConfirm={handleClearAll}
          onCancel={() => setClearAllPending(false)}
        />
      )}

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={clsx(
          "flex flex-col h-full bg-[rgba(2,4,14,0.65)] backdrop-blur-md border-r border-[rgb(var(--sidebar-border))]",
          "fixed inset-y-0 left-0 z-40 w-72",
          "transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "md:w-14" : "md:w-60",
          "md:relative md:inset-auto md:z-auto md:translate-x-0 md:flex-shrink-0",
          "overflow-hidden",
        )}
      >
        {/* Header: logo + collapse toggle */}
        <div className="flex items-center border-b border-[rgb(var(--sidebar-border))] flex-shrink-0">
          <div
            className={clsx(
              "flex items-center gap-3 py-4 transition-all duration-300 min-w-0",
              collapsed ? "px-[9px]" : "px-4 flex-1"
            )}
          >
            <Image
              src="/images/hugo-logo.png"
              alt="Hugo"
              width={40}
              height={40}
              onClick={handleLogoClick}
              className={clsx(
                "flex-shrink-0 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.2)] cursor-pointer select-none",
                logoWobbling && "animate-logo-wobble"
              )}
            />
            {!collapsed && (
              <p className="text-[rgb(var(--sidebar-fg))] font-semibold tracking-[0.15em] text-sm leading-none whitespace-nowrap">
                HUGO
              </p>
            )}
          </div>

          <button
            onClick={() => setCollapsed((c) => !c)}
            className={clsx(
              "hidden md:flex flex-shrink-0 items-center justify-center text-[rgb(var(--muted))] hover:text-[rgb(var(--sidebar-fg))] transition-colors",
              collapsed ? "w-14 h-[65px]" : "w-8 h-[65px] mr-1"
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
                bg-gradient-to-br from-purple-600 to-purple-700
                hover:from-purple-500 hover:to-purple-600
                text-white transition-all
                shadow-[0_0_12px_rgba(147,51,234,0.35)]
                hover:shadow-[0_0_16px_rgba(147,51,234,0.55)]"
              aria-label="New conversation"
            >
              <Plus className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleNew}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg
                bg-gradient-to-r from-purple-600 to-purple-700
                hover:from-purple-500 hover:to-purple-600
                text-white text-sm font-medium tracking-wide
                transition-all shadow-[0_0_16px_rgba(147,51,234,0.35)]
                hover:shadow-[0_0_20px_rgba(147,51,234,0.55)]"
            >
              <Plus className="w-4 h-4" />
              New chat
            </button>
          )}
        </div>

        {/* Conversation list — hidden when collapsed */}
        {!collapsed && (
          <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2 space-y-0.5">
            {conversations.filter((c) => c.title).length === 0 && (
              <p className="text-center text-[10px] text-[rgb(var(--muted))] mt-8 px-3 leading-relaxed">
                No conversations yet
              </p>
            )}
            {conversations.filter((c) => c.title).map((conv) => (
              <div
                key={conv.id}
                onClick={() => fadingId !== conv.id && handleSelect(conv.id)}
                className={clsx(
                  "group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm",
                  fadingId === conv.id
                    ? "animate-conv-remove pointer-events-none"
                    : clsx(
                        "transition-all",
                        activeId === conv.id
                          ? "bg-purple-500/10 text-purple-300 border border-purple-500/20 shadow-[inset_0_0_12px_rgba(147,51,234,0.08)]"
                          : "text-[rgb(var(--muted))] hover:bg-white/5 hover:text-[rgb(var(--sidebar-fg))] border border-transparent"
                      )
                )}
              >
                <div className="flex-1 min-w-0">
                  <span className="block truncate leading-snug">{conv.title ?? "New conversation"}</span>
                </div>
                <button
                  onClick={(e) => handleDelete(e, conv.id)}
                  className="opacity-0 group-hover:opacity-100 ml-1 flex-shrink-0 text-[rgb(var(--muted))] hover:text-red-400 transition-all"
                  aria-label="Delete conversation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </nav>
        )}

        {/* Collapsed: dot indicators */}
        {collapsed && conversations.filter((c) => c.title).length > 0 && (
          <div className="flex-1 flex flex-col items-center pt-2 gap-1.5 overflow-hidden">
            {conversations.filter((c) => c.title).slice(0, 8).map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleSelect(conv.id)}
                title={conv.title ?? "New conversation"}
                className={clsx(
                  "w-2 h-2 rounded-full transition-all flex-shrink-0",
                  activeId === conv.id
                    ? "bg-purple-400 shadow-[0_0_6px_rgba(147,51,234,0.6)]"
                    : "bg-[rgb(var(--border))] hover:bg-[rgb(var(--muted))]"
                )}
              />
            ))}
          </div>
        )}

        {/* Bottom: settings panel + user bar */}
        <div className="flex-shrink-0 border-t border-[rgb(var(--sidebar-border))]" ref={settingsRef}>

          {/* Settings panel (expanded only) */}
          {!collapsed && settingsOpen && (
            <div className="px-3 py-3 space-y-2 border-b border-[rgb(var(--sidebar-border))]">
              {/* Remember conversations toggle */}
              <button
                onClick={handleToggleClick}
                className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg
                  text-[rgb(var(--muted))] hover:text-[rgb(var(--sidebar-fg))] hover:bg-white/5 transition-all text-xs"
              >
                <span>Remember conversations</span>
                {user?.rememberConversations
                  ? <ToggleRight className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  : <ToggleLeft className="w-4 h-4 flex-shrink-0" />
                }
              </button>

              {/* Clear all chats */}
              <button
                onClick={() => setClearAllPending(true)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg
                  text-[rgb(var(--muted))] hover:text-red-400 hover:bg-red-500/5 transition-all text-xs"
              >
                <Trash className="w-3.5 h-3.5 flex-shrink-0" />
                Clear all chats
              </button>
            </div>
          )}

          {/* User info bar */}
          <div className={clsx("flex items-center gap-2", collapsed ? "flex-col py-3 px-2" : "px-3 py-3")}>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[rgb(var(--sidebar-fg))] truncate leading-none">
                  {user?.displayName ?? ""}
                </p>
                <p className="text-[10px] text-[rgb(var(--muted))] truncate mt-0.5">
                  {user?.email ?? ""}
                </p>
              </div>
            )}

            {/* Settings toggle */}
            <button
              onClick={() => {
              if (collapsed) { setCollapsed(false); setSettingsOpen(true); }
              else { setSettingsOpen((o) => !o); }
            }}
              title="Settings"
              className={clsx(
                "flex-shrink-0 flex items-center justify-center rounded-lg transition-colors",
                "text-[rgb(var(--muted))] hover:text-[rgb(var(--sidebar-fg))]",
                collapsed ? "w-10 h-10" : "w-7 h-7",
                settingsOpen && !collapsed && "text-purple-400"
              )}
              aria-label="Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>

            {/* Sign out */}
            <button
              onClick={handleLogout}
              title="Sign out"
              className={clsx(
                "flex-shrink-0 flex items-center justify-center rounded-lg transition-colors",
                "text-[rgb(var(--muted))] hover:text-red-400",
                collapsed ? "w-10 h-10" : "w-7 h-7"
              )}
              aria-label="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
