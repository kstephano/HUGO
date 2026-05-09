/**
 * Main chat UI: manages WebSocket lifecycle, dispatches frames to the Zustand store,
 * and renders the message list + input form.
 */
"use client";
import { useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
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
  const wsRef = useRef<HugoWebSocket | null>(null);

  const setConnectionStatus = useStore((s) => s.setConnectionStatus);
  const appendStreamDelta = useStore((s) => s.appendStreamDelta);
  const appendThinkingDelta = useStore((s) => s.appendThinkingDelta);
  const addToolUse = useStore((s) => s.addToolUse);
  const setToolResult = useStore((s) => s.setToolResult);
  const finalizeStreaming = useStore((s) => s.finalizeStreaming);
  const appendMessage = useStore((s) => s.appendMessage);
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
        // Synthetic message for display — full message fetched on next load
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
      case "error":
        setIsStreaming(false);
        finalizeStreaming();
        console.error("ws_error", frame.code, frame.message);
        break;
      case "rate_limited":
        setIsStreaming(false);
        finalizeStreaming();
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

  const handleSend = () => {
    const content = input.trim();
    if (!content || isStreaming) return;

    const clientMessageId = uuid();
    // Optimistic user message
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

  const handleCancel = () => {
    wsRef.current?.sendCancel();
    setIsStreaming(false);
    finalizeStreaming();
  };

  return (
    <div className="flex flex-col h-full">
      <MessageList conversationId={conversationId} isPending={isStreaming} />

      <div className="border-t border-slate-200 p-4 bg-white">
        <div className="flex gap-3 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Send a message…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-40 overflow-y-auto"
            style={{ height: "auto" }}
          />
          {isStreaming ? (
            <button
              onClick={handleCancel}
              className="px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
