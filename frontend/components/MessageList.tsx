"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Markdown from "markdown-to-jsx";
import { useStore } from "@/lib/store";
import { User } from "lucide-react";
import type { Message } from "@/lib/types";
import clsx from "clsx";

const SPINNER_VERBS = [
  "Beaming", "Booping", "Bouncing", "Brewing", "Bubbling", "Chasing",
  "Churning", "Coalescing", "Conjuring", "Cooking", "Crafting", "Crunching",
  "Cuddling", "Dancing", "Dazzling", "Discovering", "Doodling", "Dreaming",
  "Drifting", "Enchanting", "Exploring", "Finding", "Floating", "Fluttering",
  "Foraging", "Forging", "Frolicking", "Gathering", "Giggling", "Gliding",
  "Greeting", "Growing", "Hatching", "Herding", "Honking", "Hopping",
  "Hugging", "Humming", "Imagining", "Inventing", "Jingling", "Juggling",
  "Jumping", "Kindling", "Knitting", "Launching", "Leaping", "Mapping",
  "Marinating", "Meandering", "Mixing", "Moseying", "Munching", "Napping",
  "Nibbling", "Noodling", "Orbiting", "Painting", "Percolating", "Petting",
  "Plotting", "Pondering", "Popping", "Prancing", "Purring", "Puzzling",
  "Questing", "Riding", "Roaming", "Rolling", "Sauteeing", "Scribbling",
  "Seeking", "Shimmying", "Singing", "Skipping", "Sleeping", "Snacking",
  "Sniffing", "Snuggling", "Soaring", "Sparking", "Spinning", "Splashing",
  "Sprouting", "Squishing", "Stargazing", "Stirring", "Strolling", "Swimming",
  "Swinging", "Tickling", "Tinkering", "Toasting", "Tumbling", "Twirling",
  "Waddling", "Wandering", "Watching", "Weaving", "Whistling", "Wibbling",
  "Wiggling", "Wishing", "Wobbling", "Wondering", "Yawning", "Zooming",
] as const;

const OPENING_LINE = "Alright, alright, alright...";

const SUGGESTED_PROMPTS = [
  "What happened in the world this week?",
  "Walk me through how transformers actually work.",
  "Is it ever ethical to lie? Give me a balanced answer.",
  "Explain quantum entanglement — I'm smart, not a physicist.",
  "What's the difference between machine learning and deep learning?",
  "Argue both sides of universal basic income.",
  "Summarise the key global events from the last month.",
  "What's the hardest unsolved problem facing humanity?",
  "Could love actually be a quantifiable force like gravity?",
  "What would really happen if you fell into a black hole?",
  "What's the biggest tech story this week?",
  "What's the latest news on AI regulation?",
  "What films are in cinemas right now?",
];

interface Props {
  conversationId: string;
  isPending?: boolean;
  onPromptSelect?: (text: string) => void;
  onRevealInput?: () => void;
}

function EmptyState({ onPromptSelect, onRevealInput }: { onPromptSelect?: (text: string) => void; onRevealInput?: () => void }) {
  const [promptVisible] = useState(true);
  const [promptPhase, setPromptPhase] = useState<"entering" | "holding" | "leaving">("entering");
  const [promptIndex, setPromptIndex] = useState(() =>
    Math.floor(Math.random() * SUGGESTED_PROMPTS.length)
  );
  const [promptClicked, setPromptClicked] = useState(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (promptPhase === "entering") {
      t = setTimeout(() => setPromptPhase("holding"), 1500);
    } else if (promptPhase === "holding") {
      t = setTimeout(() => setPromptPhase("leaving"), 12000);
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
        <p className="text-[18px] font-medium text-white">{OPENING_LINE}</p>
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

          {/* Buttons */}
          <div className="flex items-center justify-center gap-3 mt-3">
            <button
              onClick={() => onPromptSelect?.(SUGGESTED_PROMPTS[promptIndex])}
              className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] border transition-all
                border-[#FFE81F]/50 text-[#FFE81F]/70 hover:border-[#FFE81F] hover:text-[#FFE81F] hover:bg-[#FFE81F]/5"
            >
              Send
            </button>
            <button
              onClick={() => promptPhase !== "leaving" && setPromptPhase("leaving")}
              className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] border transition-all
                border-[#FFE81F]/25 text-[#FFE81F]/40 hover:border-[#FFE81F]/60 hover:text-[#FFE81F]/70"
              aria-label="Next prompt"
            >
              →
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
        <div className="prose prose-sm prose-invert max-w-none break-words">
          <Markdown>{text}</Markdown>
        </div>
        {msg.status === "cancelled" && (
          <span className="mt-1 block text-[10px] opacity-50 italic">generation stopped</span>
        )}
      </div>
    </div>
  );
}

const randomVerb = () => SPINNER_VERBS[Math.floor(Math.random() * SPINNER_VERBS.length)];

function StreamingBubble({ isPending }: { isPending: boolean }) {
  const streaming = useStore((s) => s.streaming);
  const isActive = !!(streaming && !streaming.isComplete);
  const active = isActive ? streaming : null;
  const [spinVerb, setSpinVerb] = useState(randomVerb);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const fullTextRef = useRef("");
  const displayedLenRef = useRef(0);

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setSpinVerb(randomVerb()), 3000);
    return () => clearInterval(id);
  }, [isActive]);

  useEffect(() => {
    if (!isActive) { setElapsedSeconds(0); return; }
    setElapsedSeconds(0);
    const id = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isActive]);

  // Keep fullTextRef in sync with incoming deltas
  useEffect(() => {
    if (active) fullTextRef.current = active.text;
  }, [active?.text]);

  // Typewriter: reset on stream start; drip chars with adaptive catch-up
  useEffect(() => {
    if (!isActive) return;
    displayedLenRef.current = 0;
    setDisplayedText("");
    const id = setInterval(() => {
      const full = fullTextRef.current;
      const cur = displayedLenRef.current;
      if (cur >= full.length) return;
      const debt = full.length - cur;
      const step = debt > 300 ? 20 : debt > 100 ? 6 : debt > 30 ? 2 : 1;
      const next = Math.min(cur + step, full.length);
      displayedLenRef.current = next;
      setDisplayedText(full.slice(0, next));
    }, 16);
    return () => clearInterval(id);
  }, [isActive]);

  if (!isActive && !isPending) return null;

  const estimatedTokens = active ? Math.round(active.text.length / 4) : 0;

  return (
    <div className="flex items-end gap-2.5">
      {/* Avatar */}
      <div className="flex-shrink-0 w-7 h-7 rounded-full overflow-hidden">
        <Image src="/images/hugo-logo.png" alt="Hugo" width={28} height={28} className="rounded-full" />
      </div>

      {/* Bubble */}
      <div className="max-w-[72%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed bg-[rgb(var(--bubble-assistant))] text-[rgb(var(--fg))] border border-[rgb(var(--border))] shadow-sm">
        {/* Pending state — no tokens yet */}
        {isPending && !isActive && (
          <span className="flex items-center gap-1.5 text-xs italic" style={{ color: "#FFE81F" }}>
            <span className="w-1 h-1 rounded-full animate-bounce [animation-delay:0ms]" style={{ backgroundColor: "#FFE81F" }} />
            <span className="w-1 h-1 rounded-full animate-bounce [animation-delay:150ms]" style={{ backgroundColor: "#FFE81F" }} />
            <span className="w-1 h-1 rounded-full animate-bounce [animation-delay:300ms]" style={{ backgroundColor: "#FFE81F" }} />
          </span>
        )}

        {/* Thinking — cycling verb + elapsed time + estimated tokens */}
        {isActive && (
          <p className="mb-2.5 flex items-center gap-1.5 text-[11px] italic" style={{ color: "#FFE81F" }}>
            <span
              className="animate-thinking-cycle flex-shrink-0"
              style={{ color: "#FFE81F", fontSize: "13px", width: "14px", height: "14px" }}
            >
              *
            </span>
            {spinVerb}…
            <span className="not-italic opacity-50 text-[9px] tracking-wide">
              ({elapsedSeconds}s{estimatedTokens > 0 ? `, ~${estimatedTokens} tokens` : ""})
            </span>
          </p>
        )}

        {/* Tool-use badges */}
        {active && active.toolUses.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {active.toolUses
              .reduce<{ toolName: string; count: number; allDone: boolean }[]>((acc, t) => {
                const existing = acc.find((g) => g.toolName === t.toolName);
                if (existing) {
                  existing.count++;
                  if (!t.result) existing.allDone = false;
                } else {
                  acc.push({ toolName: t.toolName, count: 1, allDone: !!t.result });
                }
                return acc;
              }, [])
              .map((g) => (
                <span
                  key={g.toolName}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-medium border border-purple-500/20"
                >
                  {!g.allDone && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />}
                  {g.toolName}
                  {g.count >= 2 && <span className="opacity-60 ml-0.5">{g.count}x</span>}
                  {g.allDone && <span className="text-emerald-500 ml-0.5">✓</span>}
                </span>
              ))}
          </div>
        )}

        {/* Streaming text */}
        {active && (
          <div className="relative">
            <div className="prose prose-sm prose-invert max-w-none break-words">
              <Markdown>{displayedText}</Markdown>
            </div>
            <span className="inline-block w-0.5 h-[1em] bg-[rgb(var(--fg))] opacity-70 animate-pulse ml-0.5 align-text-bottom rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
}

export function MessageList({ conversationId, isPending = false, onPromptSelect, onRevealInput }: Props) {
  const messages = useStore((s) => s.messagesByConv[conversationId] ?? []);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isPending]);

  if (messages.length === 0 && !isPending) {
    return <EmptyState onPromptSelect={onPromptSelect} onRevealInput={onRevealInput} />;
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
