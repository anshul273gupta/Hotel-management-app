"use client";

import { useEffect } from "react";

/**
 * Every minute was far too often: this endpoint writes to the database, and
 * with the app open on a phone it fired 60 times an hour per device for work
 * that only matters around check-in and check-out times. Five minutes is
 * still well inside the hotel's tolerance and cuts the traffic 5x.
 */
const CHECK_INTERVAL_MS = 5 * 60_000;

/**
 * Periodically asks the server to auto check-in reservations whose check-in
 * time has arrived and auto check-out stays past their expected check-out.
 * Renders nothing — runs in the background for any signed-in user with the
 * dashboard open.
 */
export function AutoBookingProcessor() {
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function run() {
      // Pointless while the app is in the background — and on a phone the OS
      // throttles it anyway. The visibility handler catches up on return.
      if (cancelled || document.visibilityState !== "visible") return;
      fetch("/api/bookings/auto-process", { method: "POST" }).catch(() => {
        // best-effort; will retry on the next interval tick
      });
    }

    function schedule() {
      timer = setTimeout(() => {
        run();
        schedule();
      }, CHECK_INTERVAL_MS);
    }

    run();
    schedule();

    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
