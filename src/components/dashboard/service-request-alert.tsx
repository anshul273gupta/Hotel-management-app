"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useRealtime } from "@/hooks/use-realtime";
import type { Notification } from "@prisma/client";

function playTing() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;

    // Plays one note of the tri-tone with a shimmer overtone
    function playNote(freq: number, delay: number) {
      const noteDuration = 0.22;
      const peak = 0.7;

      // Fundamental sine — the clean "ding"
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gainNode.gain.setValueAtTime(0, t + delay);
      gainNode.gain.linearRampToValueAtTime(peak, t + delay + 0.008); // crisp attack
      gainNode.gain.exponentialRampToValueAtTime(0.001, t + delay + noteDuration);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(t + delay);
      osc.stop(t + delay + noteDuration);

      // Octave shimmer — gives it the bright iPhone "ring" quality
      const osc2 = ctx.createOscillator();
      const gainNode2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.value = freq * 2;
      gainNode2.gain.setValueAtTime(0, t + delay);
      gainNode2.gain.linearRampToValueAtTime(peak * 0.12, t + delay + 0.008);
      gainNode2.gain.exponentialRampToValueAtTime(0.001, t + delay + noteDuration * 0.65);
      osc2.connect(gainNode2);
      gainNode2.connect(ctx.destination);
      osc2.start(t + delay);
      osc2.stop(t + delay + noteDuration);
    }

    // iPhone tri-tone: three quick ascending notes (E major arpeggio)
    playNote(1040, 0);     // first note  — C6
    playNote(1317, 0.13);  // second note — E6
    playNote(1568, 0.26);  // third note  — G6 (bright finish)
  } catch {
    // AudioContext blocked or unavailable — fail silently
  }
}

export function ServiceRequestAlert() {
  const [queue, setQueue] = useState<Notification[]>([]);

  useRealtime((kind, data) => {
    if (kind !== "notification") return;
    const notification = (data as { data: Notification }).data;
    if (notification.type !== "SERVICE_REQUEST") return;

    playTing();
    setQueue((prev) => [...prev, notification]);
  });

  const dismiss = useCallback(() => {
    setQueue((prev) => {
      const next = prev.slice(1);
      if (next.length > 0) playTing();
      return next;
    });
  }, []);

  const current = queue[0];
  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-sm rounded-2xl bg-card p-7 shadow-2xl ring-1 ring-border">
        {/* Queue counter */}
        {queue.length > 1 && (
          <div className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
            {queue.length} pending
          </div>
        )}

        <button
          onClick={dismiss}
          className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-primary/15 text-4xl shadow-inner">
            🔔
          </div>

          <div>
            <p className="text-xl font-semibold">{current.title}</p>
            <p className="mt-1.5 text-sm text-muted-foreground">{current.message}</p>
          </div>

          {queue.length > 1 && (
            <p className="text-xs text-muted-foreground">
              Dismiss to see next request ({queue.length - 1} more)
            </p>
          )}

          <div className="flex w-full gap-2.5 pt-1">
            {current.link && (
              <Link
                href={current.link}
                onClick={dismiss}
                className="flex-1 rounded-xl bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90"
              >
                View Request
              </Link>
            )}
            <button
              onClick={dismiss}
              className="flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              {queue.length > 1 ? "Dismiss & Next" : "Dismiss"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
