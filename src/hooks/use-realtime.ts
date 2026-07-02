"use client";

import { useEffect, useId, useRef } from "react";
import { useRealtimeContext } from "@/lib/realtime-context";

export type RealtimeEventKind =
  | "connected"
  | "notification"
  | "rooms-updated"
  | "bookings-updated"
  | "requests-updated"
  | "dashboard-updated"
  | "guests-updated";

export function useRealtime(onEvent: (kind: RealtimeEventKind, data: unknown) => void) {
  const id = useId();
  const handlerRef = useRef(onEvent);
  const { subscribe, unsubscribe } = useRealtimeContext();

  useEffect(() => {
    handlerRef.current = onEvent;
  });

  useEffect(() => {
    subscribe(id, (kind, data) => handlerRef.current(kind as RealtimeEventKind, data));
    return () => unsubscribe(id);
  }, [id, subscribe, unsubscribe]);
}
