"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useStore } from "@/lib/store";
import { User } from "lucide-react";
import type { Message } from "@/lib/types";
import clsx from "clsx";

const THINKING_WORDS = [
  "Thinking", "Reasoning", "Analysing", "Pondering", "Considering",
  "Processing", "Reflecting", "Deliberating", "Weighing", "Calculating",
];

const OPENING_LINE = "Alright, alright, alright...";

const SUGGESTED_PROMPTS = [
  "What happened in the world this week?",
  "Walk me through how transformers actually work.",
  "Is it ever ethical to lie? Give me a balanced answer.",
  "Explain quantum entanglement — I'm smart, not a physicist.",
  "What's the difference between machine learning and deep learning?",
  "Help me write a cover letter for a senior PM role.",
  "Argue both sides of universal basic income.",
  "Summarise the key global events from the last month.",
  "I have £50k to invest and I'm 28. What would you suggest?",
  "What's the hardest unsolved problem facing humanity?",
];

interface Props {
  conversationId: string;
  isPending?: boolean;
  onPromptSelect?: (text: string) => void;
}

function EmptyState({ onPromptSelect }: { onPromptSelect?: (text: string) => void }) {
  const [promptVisible, setPromptVisible] = useState(false);
  const [promptPhase, setPromptPhase] = useState<"entering" | "holding" | "leaving">("entering");
  const [promptIndex, setPromptIndex] = useState(() =>
    Math.floor(Math.random() * SUGGESTED_PROMPTS.length)
  );
  const [promptClicked, setPromptClicked] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setPromptVisible(true), 1000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!promptVisible) return;
    let t: ReturnType<typeof setTimeout>;
    if (promptPhase === "entering") {
      t = setTimeout(() => setPromptPhase("holding"), 1500);
    } else if (promptPhase === "holding") {
      t = setTimeout(() => setPromptPhase("leaving"), 30000);
    } else {
      t = setTimeout(() => {
        setPromptIndex((i) => (i + 1) % SUGGESTED_PROMPTS.length);
        setPromptPhase("entering");
        setPromptClicked(false);
      }, 800);
    }
    return () => clearTimeout(t);
  }, [promptVisible, promptPhase]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4">
      {/* Logo + greeting — shifts up when prompt appears */}
      <div
        className={clsx(
          "flex flex-col items-center gap-3 transition-transform duration-700",
          promptVisible && "-translate-y-8"
        )}
      >
        <Image
          src="/images/hugo-logo.png"
          alt="Hugo"
          width={52}
          height={52}
          className="rounded-full shadow-[0_0_20px_rgba(245,158,11,0.2)]"
        />
        <p className="text-sm text-[rgb(var(--muted))] italic">{OPENING_LINE}</p>
      </div>

      {/* Star Wars style prompt card */}
      {promptVisible && (
        <div
          className={clsx(
            "mt-8 w-full max-w-sm transition-opacity duration-500",
            promptPhase === "entering" && "animate-sw-enter",
            promptPhase === "leaving" && "animate-sw-exit",
            promptClicked && "opacity-40"
          )}
        >
          {/* Perspective crawl container */}
          <div style={{ perspective: "400px" }}>
            <div
              className="bg-black/90 border-t-2 border-b-2 border-[#FFE81F]/40 px-6 py-5 text-center"
              style={{ transform: "rotateX(10deg)", transformOrigin: "bottom center" }}
            >
              <p className="text-[#FFE81F] font-bold italic leading-relaxed text-sm tracking-wide">
                {SUGGESTED_PROMPTS[promptIndex]}
              </p>
            </div>
          </div>

          {/* Use this button */}
          <div className="flex justify-center mt-3">
            <button
              onClick={() => {
                if (promptClicked) return;
                setPromptClicked(true);
                onPromptSelect?.(SUGGESTED_PROMPTS[promptIndex]);
              }}
              className={clsx(
                "px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] border transition-all",
                promptClicked
                  ? "border-[#FFE81F]/25 text-[#FFE81F]/40 cursor-default"
                  : "border-[#FFE81F]/50 text-[#FFE81F]/70 hover:border-[#FFE81F] hover:text-[#FFE81F] hover:bg-[#FFE81F]/5"
              )}
            >
              {promptClicked ? "Loaded ✓" : "Use this"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
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
          "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center overflow-hidden",
          isUser
            ? "bg-gradient-to-br from-purple-500 to-purple-700 shadow-[0_0_8px_rgba(147,51,234,0.45)]"
            : ""
        )}
      >
        {isUser
          ? <User className="w-3.5 h-3.5 text-white" />
          : <Image src="/images/hugo-logo.png" alt="Hugo" width={28} height={28} className="rounded-full" />
        }
      </div>

      {/* Bubble */}
      <div
        className={clsx(
          "max-w-[72%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-gradient-to-br from-purple-600 to-purple-800 text-white rounded-br-sm shadow-[0_0_12px_rgba(147,51,234,0.25)]"
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
  const [thinkWord, setThinkWord] = useState(THINKING_WORDS[0]);

  useEffect(() => {
    if (!active || !streaming?.thinking) return;
    const id = setInterval(() => {
      setThinkWord(THINKING_WORDS[Math.floor(Math.random() * THINKING_WORDS.length)]);
    }, 1800);
    return () => clearInterval(id);
  }, [active, streaming?.thinking]);

  if (!active && !isPending) return null;

  return (
    <div className="flex items-end gap-2.5">
      {/* Avatar */}
      <div className="flex-shrink-0 w-7 h-7 rounded-full overflow-hidden">
        <Image src="/images/hugo-logo.png" alt="Hugo" width={28} height={28} className="rounded-full" />
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

        {/* Extended thinking — single cycling word */}
        {active && streaming.thinking && (
          <p className="mb-2.5 flex items-center gap-1.5 text-[11px] text-[rgb(var(--muted))] italic">
            <span className="w-1 h-1 rounded-full bg-[rgb(var(--muted))] animate-pulse flex-shrink-0" />
            {thinkWord}…
          </p>
        )}

        {/* Tool-use badges */}
        {active && streaming.toolUses.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {streaming.toolUses.map((t) => (
              <span
                key={t.toolUseId}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-medium border border-purple-500/20"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
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

export function MessageList({ conversationId, isPending = false, onPromptSelect }: Props) {
  const messages = useStore((s) => s.messagesByConv[conversationId] ?? []);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isPending]);

  if (messages.length === 0 && !isPending) {
    return <EmptyState onPromptSelect={onPromptSelect} />;
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 sm:px-4 sm:py-6">
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
