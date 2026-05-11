/**
 * WebSocket client with exponential backoff reconnect.
 * Maintains a single connection per browser tab.
 */
import type { WsFrame } from "./types";
import { api } from "./api";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";
const MAX_RETRIES = 8;
const BASE_DELAY_MS = 250;

export type FrameHandler = (frame: WsFrame) => void;

export class HugoWebSocket {
  private ws: WebSocket | null = null;
  private conversationId: string | null = null;
  private retryCount = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private frameHandler: FrameHandler | null = null;
  private statusHandler: ((s: string) => void) | null = null;

  constructor(
    private onFrame: FrameHandler,
    private onStatus: (status: string) => void
  ) {
    this.frameHandler = onFrame;
    this.statusHandler = onStatus;
  }

  async connect() {
    if (this.destroyed || this.ws?.readyState === WebSocket.OPEN) return;
    this.onStatus("connecting");
    let wsUrl = `${WS_BASE}/ws`;
    try {
      const { ticket } = await api.auth.wsTicket();
      wsUrl = `${WS_BASE}/ws?ticket=${ticket}`;
    } catch {
      // proceed without ticket — will fail auth if cookie is cross-origin
    }
    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      this.retryCount = 0;
      this.onStatus("connected");
      if (this.conversationId) {
        this.sendHandshake(this.conversationId);
      }
    };

    ws.onmessage = (ev) => {
      try {
        const frame = JSON.parse(ev.data) as WsFrame;
        this.frameHandler?.(frame);
      } catch {
        console.warn("ws: invalid JSON frame", ev.data);
      }
    };

    ws.onclose = () => {
      this.ws = null;
      if (!this.destroyed) {
        this.onStatus("disconnected");
        this.scheduleReconnect();
      }
    };

    ws.onerror = () => {
      this.onStatus("error");
    };
  }

  private scheduleReconnect() {
    if (this.retryCount >= MAX_RETRIES || this.destroyed) return;
    const delay = Math.min(BASE_DELAY_MS * 2 ** this.retryCount, 30_000);
    this.retryTimer = setTimeout(() => {
      this.retryCount++;
      this.connect();
    }, delay);
  }

  sendHandshake(conversationId: string) {
    this.conversationId = conversationId;
    this.send({ type: "handshake", conversation_id: conversationId });
  }

  sendMessage(content: string, clientMessageId: string, imageData?: string, imageMediaType?: string) {
    this.send({
      type: "message",
      content,
      client_message_id: clientMessageId,
      ...(imageData && imageMediaType ? { image_data: imageData, image_media_type: imageMediaType } : {}),
    });
  }

  sendCancel() {
    this.send({ type: "cancel" });
  }

  private send(obj: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.ws?.close();
    this.ws = null;
  }
}
