/**
 * Main chat UI: manages WebSocket lifecycle, dispatches frames to the Zustand store,
 * and renders the message list + input form.
 */
"use client";
import { useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import Image from "next/image";
import { Square } from "lucide-react";
import { useStore } from "@/lib/store";
import { HugoWebSocket } from "@/lib/ws";
import { MessageList } from "./MessageList";
import type { WsFrame } from "@/lib/types";

interface Props {
  conversationId: string;
}

export function ChatInterface({ conversationId }: Props) {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [inputVisible, setInputVisible] = useState(false);
  const wsRef = useRef<HugoWebSocket | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messages = useStore((s) => s.messagesByConv[conversationId] ?? []);
  const setConnectionStatus = useStore((s) => s.setConnectionStatus);
  const setDraftInput = useStore((s) => s.setDraftInput);
  const appendStreamDelta = useStore((s) => s.appendStreamDelta);
  const appendThinkingDelta = useStore((s) => s.appendThinkingDelta);
  const addToolUse = useStore((s) => s.addToolUse);
  const setToolResult = useStore((s) => s.setToolResult);
  const finalizeStreaming = useStore((s) => s.finalizeStreaming);
  const appendMessage = useStore((s) => s.appendMessage);
  const updateConversationTitle = useStore((s) => s.updateConversationTitle);
  const streaming = useStore((s) => s.streaming);

  // Keep ref in sync so the stale handleFrame closure always reads the current streaming state
  const streamingRef = useRef(streaming);
  streamingRef.current = streaming;

  const handleFrame = (frame: WsFrame) => {
    switch (frame.type) {
      case "delta":
        appendStreamDelta(conversationId, frame.text);
        break;
      case "thinking":
        appendThinkingDelta(conversationId, frame.text);
        break;
      case "tool_start":
        addToolUse(conversationId, frame.tool_use_id, frame.tool_name);
        break;
      case "tool_result":
        setToolResult(conversationId, frame.tool_use_id, frame.content);
        break;
      case "done":
        finalizeStreaming();
        setIsStreaming(false);
        appendMessage({
          id: frame.message_id,
          conversationId,
          role: "assistant",
          content: streamingRef.current?.text ?? "",
          toolCalls: null,
          status: "completed",
          inputTokens: frame.input_tokens,
          outputTokens: frame.output_tokens,
          cacheReadTokens: frame.cache_read_tokens,
          cacheWriteTokens: frame.cache_write_tokens,
          createdAt: new Date().toISOString(),
        });
        break;
      case "title":
        updateConversationTitle(conversationId, frame.title);
        break;
      case "error":
        setIsStreaming(false);
        finalizeStreaming();
        setErrorMsg(frame.message || "Something went wrong. Please try again.");
        break;
      case "rate_limited":
        setIsStreaming(false);
        finalizeStreaming();
        setErrorMsg("Too many messages. Please wait a moment before trying again.");
        break;
    }
  };

  useEffect(() => {
    const ws = new HugoWebSocket(handleFrame, (status) => {
      setConnectionStatus(status as any);
      if (status === "connected") {
        ws.sendHandshake(conversationId);
      }
    });
    wsRef.current = ws;
    ws.connect();
    return () => ws.destroy();
  }, [conversationId]);

  // Reset input bar visibility when switching to a new empty conversation
  useEffect(() => {
    if (messages.length === 0) setInputVisible(false);
  }, [conversationId]);

  // Keep store in sync so sidebar can read draft state
  useEffect(() => { setDraftInput(input); }, [input]);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const sendContent = (content: string) => {
    if (!content.trim() || isStreaming) return;
    setInputVisible(true);
    setErrorMsg(null);
    const clientMessageId = uuid();
    appendMessage({
      id: clientMessageId,
      conversationId,
      role: "user",
      content,
      toolCalls: null,
      status: "completed",
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      createdAt: new Date().toISOString(),
    });
    wsRef.current?.sendMessage(content, clientMessageId);
    setInput("");
    setIsStreaming(true);
  };

  const handleSend = () => sendContent(input.trim());

  const handleCancel = () => {
    wsRef.current?.sendCancel();
    setIsStreaming(false);
    finalizeStreaming();
  };

  const showInputBar = inputVisible || isStreaming || messages.length > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <MessageList
        conversationId={conversationId}
        isPending={isStreaming}
        onPromptSelect={sendContent}
        onRevealInput={() => setInputVisible(true)}
      />

      {/* Error banner */}
      {errorMsg && (
        <div className="flex-shrink-0 px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-red-400 text-xs text-center tracking-wide">
          {errorMsg}
        </div>
      )}

      {/* Input bar — hidden until user acts on empty conversation */}
      {showInputBar && <div className="flex-shrink-0 border-t border-[rgb(var(--border))] bg-[rgba(5,9,22,0.82)] backdrop-blur-sm px-3 py-2 sm:px-4 sm:py-3">
        <div className="max-w-3xl mx-auto flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask Hugo anything…"
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-xl border border-[rgb(var(--border))]
              bg-[rgb(var(--bg))] text-[rgb(var(--fg))]
              placeholder:text-[rgb(var(--muted))]
              px-4 py-2.5 text-sm
              focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40
              transition-all overflow-hidden disabled:opacity-40"
          />
          {isStreaming ? (
            <button
              onClick={handleCancel}
              className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl
                bg-red-500/90 hover:bg-red-400 text-white transition-colors"
              aria-label="Stop"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl
                bg-[rgba(10,8,20,0.92)] border border-purple-500/25
                hover:border-purple-400/50 hover:bg-[rgba(20,12,40,0.95)]
                disabled:opacity-30 disabled:cursor-not-allowed
                transition-all
                shadow-[0_0_12px_rgba(147,51,234,0.2)]
                hover:shadow-[0_0_18px_rgba(147,51,234,0.45)]"
              aria-label="Send"
            >
              <Image src="/images/arrow-button.svg" alt="Send" width={22} height={22} />
            </button>
          )}
        </div>
        <p className="hidden sm:block text-center text-[10px] text-[rgb(var(--muted))] mt-2 tracking-wide">
          Enter to send · Shift + Enter for new line
        </p>
      </div>}
    </div>
  );
}
