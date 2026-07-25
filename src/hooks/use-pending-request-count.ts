"use client";

import { useCallback, useEffect, useState } from "react";
import { useRealtime } from "@/hooks/use-realtime";

/**
 * Live count of pending service requests, shared by the sidebar and the
 * mobile tab bar so the badge can't disagree between the two.
 *
 * The fetch is started from inside the effect (rather than calling a
 * setState-ing callback synchronously in the effect body) and stale responses
 * are discarded, which avoids the cascading re-render React warns about.
 */
export function usePendingRequestCount() {
  const [pendingRequests, setPendingRequests] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch("/api/service-requests/pending-count", {
          signal: controller.signal,
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setPendingRequests(data.count ?? 0);
      } catch {
        // Network hiccup or aborted request — keep the previous count.
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useRealtime((kind) => {
    if (kind === "requests-updated") refresh();
  });

  return pendingRequests;
}
