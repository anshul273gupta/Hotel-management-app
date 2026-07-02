"use client";

import { createContext, useCallback, useContext, useEffect, useRef } from "react";

type EventHandler = (kind: string, data: unknown) => void;

const RealtimeContext = createContext<{
  subscribe: (id: string, handler: EventHandler) => void;
  unsubscribe: (id: string) => void;
} | null>(null);

const EVENT_KINDS = [
  "connected",
  "notification",
  "rooms-updated",
  "bookings-updated",
  "requests-updated",
  "dashboard-updated",
  "guests-updated",
] as const;

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const subscribers = useRef<Map<string, EventHandler>>(new Map());

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    function connect() {
      source = new EventSource("/api/notifications/stream");

      for (const kind of EVENT_KINDS) {
        source.addEventListener(kind, (event) => {
          let data: unknown = null;
          try { data = JSON.parse((event as MessageEvent).data); } catch {}
          subscribers.current.forEach((handler) => handler(kind, data));
        });
      }

      source.onerror = () => {
        source?.close();
        if (!closed) retryTimer = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
    };
  }, []);

  const subscribe = useCallback((id: string, handler: EventHandler) => {
    subscribers.current.set(id, handler);
  }, []);

  const unsubscribe = useCallback((id: string) => {
    subscribers.current.delete(id);
  }, []);

  return (
    <RealtimeContext.Provider value={{ subscribe, unsubscribe }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtimeContext() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtimeContext used outside RealtimeProvider");
  return ctx;
}
