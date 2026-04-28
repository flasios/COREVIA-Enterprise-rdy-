/**
 * WebSocket Service
 *
 * Shared WebSocket client adapter.  Provides a typed, reconnecting
 * WebSocket wrapper that domain modules can subscribe to for
 * real-time events without coupling to the transport.
 */

export interface WsMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp?: string;
}

export type WsListener<T = unknown> = (msg: WsMessage<T>) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<WsListener>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseDelay = 1000;

  constructor(private url: string) {}

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);
          const handlers = this.listeners.get(msg.type);
          handlers?.forEach((fn) => fn(msg));
          // Also notify wildcard listeners
          const wildcardHandlers = this.listeners.get("*");
          wildcardHandlers?.forEach((fn) => fn(msg));
        } catch {
          // Ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.reconnectAttempts = 0;
  }

  on<T = unknown>(type: string, listener: WsListener<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    const set = this.listeners.get(type)!;
    set.add(listener as WsListener);
    return () => set.delete(listener as WsListener);
  }

  send(type: string, payload: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type, payload }));
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.reconnectAttempts),
      30000,
    );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
