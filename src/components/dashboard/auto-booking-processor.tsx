"use client";

import { useEffect } from "react";

const CHECK_INTERVAL_MS = 60_000;

/**
 * Periodically asks the server to auto check-in reservations whose check-in
 * time has arrived and auto check-out stays past their expected check-out.
 * Renders nothing — runs in the background for any signed-in user with the
 * dashboard open.
 */
export function AutoBookingProcessor() {
  useEffect(() => {
    let cancelled = false;

    function run() {
      fetch("/api/bookings/auto-process", { method: "POST" }).catch(() => {
        // best-effort; will retry on the next interval tick
      });
    }

    run();
    const timer = setInterval(() => {
      if (!cancelled) run();
    }, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return null;
}
