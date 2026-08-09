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
 * How often to ask the server whether anything changed.
 *
 * This is only a small stamp request (a few dozen bytes), and nothing is
 * re-rendered unless the stamp actually moved, so a fairly brisk interval stays
 * cheap. The old code re-rendered every page from the server on every tick.
 */
const POLL_INTERVAL_MS = 15_000;

/** Slower tick when the screen is on but the app has been idle for a while. */
const IDLE_POLL_INTERVAL_MS = 60_000;
const IDLE_AFTER_MS = 3 * 60_000;

/**
 * Server-Sent Events only work when one long-lived server holds the connection
 * open. On Vercel each request is a short-lived serverless function, so the
 * stream closes immediately and the browser reconnects in a loop — measured at
 * well under a second per attempt, i.e. a permanent reconnect storm on mobile
 * data. We therefore only use SSE when it proves itself: if the very first
 * stream dies almost instantly we stop trying and rely on polling alone.
 */
const SSE_MIN_USEFUL_LIFETIME_MS = 10_000;
const SSE_MAX_ATTEMPTS = 2;

type VersionMap = Record<string, string>;

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const subscribers = useRef<Map<string, EventHandler>>(new Map());

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    let sseAttempts = 0;
    let sseUsable = true;
    let inFlight = false;
    let lastVersions: VersionMap | null = null;
    let lastInteraction = Date.now();

    const broadcast = (kind: string, data: unknown) =>
      subscribers.current.forEach((handler) => handler(kind, data));

    function connect() {
      if (!sseUsable || closed) return;
      sseAttempts += 1;
      const openedAt = Date.now();
      source = new EventSource("/api/notifications/stream");

      for (const kind of EVENT_KINDS) {
        source.addEventListener(kind, (event) => {
          let data: unknown = null;
          try {
            data = JSON.parse((event as MessageEvent).data);
          } catch {}
          broadcast(kind, data);
        });
      }

      source.onerror = () => {
        source?.close();
        if (closed) return;

        const lifetime = Date.now() - openedAt;
        // A stream that dies this fast is never going to work here.
        if (lifetime < SSE_MIN_USEFUL_LIFETIME_MS && sseAttempts >= SSE_MAX_ATTEMPTS) {
          sseUsable = false;
          return;
        }
        retryTimer = setTimeout(connect, 5000);
      };
    }

    /**
     * Ask the server for a small stamp of the newest row in each table, and
     * only tell the UI to refresh the parts whose stamp actually changed.
     */
    async function checkForChanges({ force = false } = {}) {
      if (closed || inFlight) return;
      if (!force && document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const res = await fetch("/api/realtime/version", { cache: "no-store" });
        if (!res.ok || closed) return;
        const versions: VersionMap = await res.json();

        // First run just records the baseline — nothing to refresh yet.
        if (!lastVersions) {
          lastVersions = versions;
          return;
        }

        const changed = (key: string) => lastVersions?.[key] !== versions[key];
        const roomsChanged = changed("rooms");
        const bookingsChanged = changed("bookings");
        const requestsChanged = changed("requests");
        const notificationsChanged = changed("notifications");

        lastVersions = versions;

        if (roomsChanged) broadcast("rooms-updated", null);
        if (bookingsChanged) {
          broadcast("bookings-updated", null);
          broadcast("guests-updated", null);
        }
        if (requestsChanged) broadcast("requests-updated", null);
        if (notificationsChanged) broadcast("notification", null);
        if (roomsChanged || bookingsChanged || requestsChanged) {
          broadcast("dashboard-updated", null);
        }
      } catch {
        // Offline or a flaky connection — try again on the next tick.
      } finally {
        inFlight = false;
      }
    }

    /** Re-arm the timer, backing off while the app is sitting untouched. */
    function scheduleNext() {
      if (closed) return;
      const idle = Date.now() - lastInteraction > IDLE_AFTER_MS;
      const delay = idle ? IDLE_POLL_INTERVAL_MS : POLL_INTERVAL_MS;
      pollTimer = setTimeout(async () => {
        await checkForChanges();
        scheduleNext();
      }, delay);
    }

    connect();
    // Record a baseline immediately so the first real change is detected.
    void checkForChanges({ force: true });
    scheduleNext();

    // Catch up the moment the user comes back to the app.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        lastInteraction = Date.now();
        void checkForChanges();
      }
    };
    const onInteract = () => {
      lastInteraction = Date.now();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("pointerdown", onInteract, { passive: true });

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (pollTimer) clearTimeout(pollTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pointerdown", onInteract);
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
