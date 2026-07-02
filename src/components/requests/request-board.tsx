"use client";

import { useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/use-realtime";
import { RequestCard } from "@/components/requests/request-card";
import { SERVICE_REQUEST_STATUS_LABELS } from "@/lib/constants";
import type { ServiceRequestWithRelations } from "@/lib/requests";
const COLUMNS = ["PENDING", "IN_PROGRESS", "COMPLETED"] as const;

const COLUMN_DOT_COLORS: Record<string, string> = {
  PENDING: "bg-rose-500",
  IN_PROGRESS: "bg-pink-500",
  COMPLETED: "bg-emerald-500",
};

const COLUMN_BADGE_COLORS: Record<string, string> = {
  PENDING: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  IN_PROGRESS: "bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300",
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
};

function playRequestSound() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    function playNote(freq: number, delay: number) {
      const noteDuration = 0.22;
      const peak = 0.7;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t + delay);
      gain.gain.linearRampToValueAtTime(peak, t + delay + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + noteDuration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + delay);
      osc.stop(t + delay + noteDuration);
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.value = freq * 2;
      gain2.gain.setValueAtTime(0, t + delay);
      gain2.gain.linearRampToValueAtTime(peak * 0.12, t + delay + 0.008);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + delay + noteDuration * 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(t + delay);
      osc2.stop(t + delay + noteDuration * 0.65);
    }
    playNote(1040, 0);
    playNote(1317, 0.13);
    playNote(1568, 0.26);
  } catch {}
}

export function RequestBoard({ requests }: { requests: ServiceRequestWithRelations[] }) {
  const router = useRouter();
  const isFirstEvent = useRef(true);

  useRealtime((kind) => {
    if (kind === "requests-updated") {
      router.refresh();
      // Skip the very first event on mount (page load SSE handshake)
      if (isFirstEvent.current) {
        isFirstEvent.current = false;
        return;
      }
      playRequestSound();
      toast.info("New service request received", {
        description: "A guest has submitted a new request.",
        duration: 5000,
      });
    }
  });

  const grouped = useMemo(() => {
    const map = new Map<string, ServiceRequestWithRelations[]>();
    for (const status of COLUMNS) map.set(status, []);
    for (const request of requests) {
      const column = request.status === "ASSIGNED" ? "PENDING" : request.status;
      map.get(column)?.push(request);
    }
    return map;
  }, [requests]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {COLUMNS.map((status) => {
        const items = grouped.get(status) ?? [];
        const hasActive = items.length > 0 && status !== "COMPLETED";
        return (
          <div key={status} className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                {/* Pulsing dot for pending/in-progress with items */}
                {hasActive ? (
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${COLUMN_DOT_COLORS[status]}`} />
                    <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${COLUMN_DOT_COLORS[status]}`} />
                  </span>
                ) : (
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${COLUMN_DOT_COLORS[status]}`} />
                )}
                {SERVICE_REQUEST_STATUS_LABELS[status]}
              </h2>
              {items.length > 0 ? (
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${COLUMN_BADGE_COLORS[status]}`}>
                  {items.length}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">0</span>
              )}
            </div>
            <div className="space-y-3">
              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                  No requests
                </p>
              ) : (
                items.map((request) => <RequestCard key={request.id} request={request} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
