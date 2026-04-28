import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient } from "@/lib/queryClient";

export interface WSMessage {
  type: string;
  payload: unknown;
}

export interface UserPresence {
  userId: string;
  displayName?: string;
  status: "online" | "away" | "busy" | "offline";
  lastSeen: Date;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toPresence = (payload: Record<string, unknown>): UserPresence | null => {
  if (typeof payload.userId !== "string") return null;
  const rawStatus = typeof payload.status === "string" ? payload.status : "offline";
  const status: UserPresence["status"] =
    rawStatus === "online" || rawStatus === "away" || rawStatus === "busy" || rawStatus === "offline"
      ? rawStatus
      : "offline";

  return {
    userId: payload.userId,
    displayName: typeof payload.displayName === "string" ? payload.displayName : undefined,
    status,
    lastSeen: payload.lastSeen instanceof Date ? payload.lastSeen : new Date(),
  };
};

// Detect if WebSocket can be safely used - disable if host is undefined (Vite dev issue)
const canUseWebSocket = (): boolean => {
  try {
    if (typeof window === 'undefined') return false;
    const host = window?.location?.host;
    return !!host && !host.includes('undefined');
  } catch (e) {
    console.warn('[WebSocket] Safety check failed, disabling:', e);
    return false;
  }
};

export function useWebSocket() {
  const { currentUser } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const ws = useRef<WebSocket | null>(null);
  const messageHandlers = useRef<Map<string, (payload: unknown) => void>>(new Map());
  const reconnectTimeout = useRef<number | null>(null);
  const reconnectAttempts = useRef(0);
  const wsEnabled = useRef(canUseWebSocket());
  const maxReconnectAttempts = 6;
  const baseReconnectDelayMs = 1000;

  const connect = useCallback(() => {
    if (!currentUser || !wsEnabled.current) return;

    if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const host = window?.location?.host;
      if (!host) {
        wsEnabled.current = false;
        console.warn("[WebSocket] Host undefined, disabling WebSocket");
        setIsConnected(false);
        return;
      }

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${host}/ws`;

      ws.current = new WebSocket(wsUrl);
    } catch (error) {
      wsEnabled.current = false;
      console.warn("[WebSocket] Connection failed, disabling:", error);
      setIsConnected(false);
      return;
    }

    ws.current.onopen = () => {
      setIsConnected(true);
      reconnectAttempts.current = 0;

      // Send presence update immediately after connection
      if (currentUser) {
        send({
          type: "presence:update",
          payload: {
            userId: currentUser.id,
            status: "online",
          },
        });

        // Request current presence list
        send({
          type: "presence:request",
          payload: {},
        });
      }
    };

    ws.current.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        const handler = messageHandlers.current.get(message.type);
        
        if (handler) {
          handler(message.payload);
        }

        // Handle presence updates globally
        if (message.type === "presence:update") {
          if (Array.isArray(message.payload)) {
            setOnlineUsers(
              message.payload
                .filter((entry): entry is Record<string, unknown> => isRecord(entry))
                .map(toPresence)
                .filter((entry): entry is UserPresence => entry !== null)
            );
          } else if (isRecord(message.payload)) {
            const presence = toPresence(message.payload);
            if (!presence) return;

            setOnlineUsers((prev) => {
              const updated = prev.filter((u) => u.userId !== presence.userId);
              if (presence.status !== "offline") {
                updated.push(presence);
              }
              return updated;
            });
          }
        }

        if (message.type === "error" && isRecord(message.payload) && typeof message.payload.message === "string") {
          if (message.payload.message.toLowerCase().includes("authentication")) {
            wsEnabled.current = false;
            setIsConnected(false);
            queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          }
        }
      } catch (error) {
        console.error("[WebSocket] Error parsing message:", error);
      }
    };

    ws.current.onerror = (error) => {
      console.error("[WebSocket] Error:", error);
    };

    ws.current.onclose = (event) => {
      setIsConnected(false);

      if (event.code === 1008 || event.reason.toLowerCase().includes("authentication")) {
        wsEnabled.current = false;
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        return;
      }

      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }

      if (reconnectAttempts.current >= maxReconnectAttempts) {
        console.warn("[WebSocket] Max reconnect attempts reached, stopping.");
        return;
      }

      reconnectAttempts.current += 1;
      const jitter = Math.floor(Math.random() * 250);
      const delay = Math.min(baseReconnectDelayMs * 2 ** (reconnectAttempts.current - 1), 30000) + jitter;
      reconnectTimeout.current = window.setTimeout(() => {
        console.log("[WebSocket] Attempting to reconnect...");
        connect();
      }, delay);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const disconnect = useCallback(() => {
    if (ws.current) {
      // Send offline status before closing
      if (currentUser) {
        send({
          type: "presence:update",
          payload: {
            userId: currentUser.id,
            status: "offline",
          },
        });
      }
      
      ws.current.close();
      ws.current = null;
    }

    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const send = useCallback((message: WSMessage) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      console.warn("[WebSocket] Cannot send message, not connected");
    }
  }, []);

  const subscribe = useCallback(<T = unknown>(messageType: string, handler: (payload: T) => void) => {
    messageHandlers.current.set(messageType, handler as (payload: unknown) => void);
    
    return () => {
      messageHandlers.current.delete(messageType);
    };
  }, []);

  const updatePresence = useCallback((status: "online" | "away" | "busy") => {
    if (currentUser) {
      send({
        type: "presence:update",
        payload: {
          userId: currentUser.id,
          status,
        },
      });
    }
  }, [currentUser, send]);

  useEffect(() => {
    if (currentUser) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [currentUser, connect, disconnect]);

  // Send offline status when page is about to unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentUser && ws.current) {
        send({
          type: "presence:update",
          payload: {
            userId: currentUser.id,
            status: "offline",
          },
        });
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [currentUser, send]);

  return {
    isConnected,
    onlineUsers,
    send,
    subscribe,
    updatePresence,
  };
}
