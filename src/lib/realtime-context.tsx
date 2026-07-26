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

/**
 * How often to re-check the server when Server-Sent Events can't be relied on.
 *
 * On a single always-on server the SSE stream delivers every change instantly.
 * On serverless hosting (Vercel) each request may be handled by a different
 * isolated instance, so an event emitted while handling one request is invisible
 * to the instance holding your stream open. Polling guarantees the UI still
 * catches up, at the cost of a short delay.
 */
const POLL_INTERVAL_MS = 20_000;

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const subscribers = useRef<Map<string, EventHandler>>(new Map());

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let closed = false;

    const broadcast = (kind: string, data: unknown) =>
      subscribers.current.forEach((handler) => handler(kind, data));

    function connect() {
      source = new EventSource("/api/notifications/stream");

      for (const kind of EVENT_KINDS) {
        source.addEventListener(kind, (event) => {
          let data: unknown = null;
          try { data = JSON.parse((event as MessageEvent).data); } catch {}
          broadcast(kind, data);
        });
      }

      source.onerror = () => {
        source?.close();
        if (!closed) retryTimer = setTimeout(connect, 3000);
      };
    }

    /**
     * Ask every listener to refetch. Handlers treat these exactly like a live
     * event, so the room grid, dashboard and badges all refresh themselves.
     */
    function pollAll() {
      if (closed || document.visibilityState !== "visible") return;
      for (const kind of ["rooms-updated", "bookings-updated", "requests-updated",
                          "dashboard-updated", "guests-updated", "notification"]) {
        broadcast(kind, null);
      }
    }

    connect();
    pollTimer = setInterval(pollAll, POLL_INTERVAL_MS);

    // Catch up immediately when the user returns to the tab.
    const onVisible = () => { if (document.visibilityState === "visible") pollAll(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (pollTimer) clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", onVisible);
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
