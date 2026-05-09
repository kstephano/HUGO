"use client";
import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
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
    <div className={clsx("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm"
        )}
      >
        {text}
        {msg.status === "cancelled" && (
          <span className="ml-2 text-xs opacity-60 italic">(cancelled)</span>
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
    <div className="flex justify-start">
      <div className="max-w-[75%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed bg-white border border-slate-200 text-slate-800 shadow-sm">
        {isPending && !active && (
          <span className="text-slate-400 italic">Thinking…</span>
        )}
        {active && streaming.thinking && (
          <div className="text-xs text-slate-400 italic mb-2 border-l-2 border-slate-200 pl-2">
            {streaming.thinking.slice(-200)}
          </div>
        )}
        {active && streaming.toolUses.map((t) => (
          <div key={t.toolUseId} className="text-xs text-indigo-500 mb-1">
            ⚙ {t.toolName}
            {t.result && <span className="text-slate-400 ml-1">✓</span>}
          </div>
        ))}
        {active && <span>{streaming.text}</span>}
        <span className="inline-block w-1.5 h-4 bg-slate-400 animate-pulse ml-0.5 align-text-bottom" />
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
    <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-6 space-y-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} msg={msg} />
      ))}
      <StreamingBubble isPending={isPending} />
      <div ref={bottomRef} />
    </div>
  );
}
