"use client";
import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { Bot, User } from "lucide-react";
import type { Message } from "@/lib/types";
import clsx from "clsx";

interface Props {
  conversationId: string;
  isPending?: boolean;
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  const text =
    typeof msg.content === "string"
      ? msg.content
      : Array.isArray(msg.content)
      ? msg.content.find((b) => b.type === "text")?.text ?? ""
      : "";

  return (
    <div className={clsx("flex items-end gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div
        className={clsx(
          "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
          isUser
            ? "bg-gradient-to-br from-amber-500 to-amber-700 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
            : "bg-[rgb(var(--border))]"
        )}
      >
        {isUser
          ? <User className="w-3.5 h-3.5 text-white" />
          : <Bot className="w-3.5 h-3.5 text-amber-400" />
        }
      </div>

      {/* Bubble */}
      <div
        className={clsx(
          "max-w-[72%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-gradient-to-br from-amber-600 to-amber-800 text-white rounded-br-sm shadow-[0_0_12px_rgba(245,158,11,0.2)]"
            : "bg-[rgb(var(--bubble-assistant))] text-[rgb(var(--fg))] border border-[rgb(var(--border))] rounded-bl-sm shadow-sm"
        )}
      >
        <p className="whitespace-pre-wrap break-words">{text}</p>
        {msg.status === "cancelled" && (
          <span className="mt-1 block text-[10px] opacity-50 italic">generation stopped</span>
        )}
      </div>
    </div>
  );
}

function StreamingBubble({ isPending }: { isPending: boolean }) {
  const streaming = useStore((s) => s.streaming);
  const active = streaming && !streaming.isComplete;
  if (!active && !isPending) return null;

  return (
    <div className="flex items-end gap-2.5">
      {/* Avatar */}
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[rgb(var(--border))] flex items-center justify-center">
        <Bot className="w-3.5 h-3.5 text-[rgb(var(--muted))]" />
      </div>

      {/* Bubble */}
      <div className="max-w-[72%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed bg-[rgb(var(--bubble-assistant))] text-[rgb(var(--fg))] border border-[rgb(var(--border))] shadow-sm">
        {/* Pending state — no tokens yet */}
        {isPending && !active && (
          <span className="flex items-center gap-1.5 text-[rgb(var(--muted))] text-xs italic">
            <span className="w-1 h-1 rounded-full bg-[rgb(var(--muted))] animate-bounce [animation-delay:0ms]" />
            <span className="w-1 h-1 rounded-full bg-[rgb(var(--muted))] animate-bounce [animation-delay:150ms]" />
            <span className="w-1 h-1 rounded-full bg-[rgb(var(--muted))] animate-bounce [animation-delay:300ms]" />
          </span>
        )}

        {/* Extended thinking — parsed into a high-level thought list */}
        {active && streaming.thinking && (() => {
          const thoughts = streaming.thinking
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 15);
          if (thoughts.length === 0) return null;
          const done = thoughts.slice(0, -1);
          const current = thoughts[thoughts.length - 1];
          return (
            <ul className="mb-2.5 space-y-1">
              {done.map((t, i) => (
                <li key={i} className="animate-thought-in flex items-start gap-1.5 text-[11px] text-[rgb(var(--muted))]">
                  <span className="mt-px flex-shrink-0 text-emerald-500">✓</span>
                  <span className="line-clamp-1">{t.slice(0, 90)}</span>
                </li>
              ))}
              <li className="flex items-start gap-1.5 text-[11px] text-[rgb(var(--muted))] italic">
                <span className="mt-1.5 w-1 h-1 flex-shrink-0 rounded-full bg-[rgb(var(--muted))] animate-pulse" />
                <span className="line-clamp-1">{current.slice(0, 90)}</span>
              </li>
            </ul>
          );
        })()}

        {/* Tool-use badges */}
        {active && streaming.toolUses.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {streaming.toolUses.map((t) => (
              <span
                key={t.toolUseId}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-medium border border-amber-500/20"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                {t.toolName}
                {t.result && <span className="text-emerald-500 ml-0.5">✓</span>}
              </span>
            ))}
          </div>
        )}

        {/* Streaming text */}
        {active && (
          <p className="whitespace-pre-wrap break-words">
            {streaming.text}
            <span className="inline-block w-0.5 h-[1em] bg-[rgb(var(--fg))] opacity-70 animate-pulse ml-0.5 align-text-bottom rounded-full" />
          </p>
        )}
      </div>
    </div>
  );
}

export function MessageList({ conversationId, isPending = false }: Props) {
  const messages = useStore((s) => s.messagesByConv[conversationId] ?? []);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isPending]);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        <StreamingBubble isPending={isPending} />
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
