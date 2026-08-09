"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Clock, CheckCircle2, BedDouble, Users, MessageCircle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRealtime } from "@/hooks/use-realtime";
import { formatDateTime } from "@/lib/format";
import { buildWhatsAppLink, whatsappTemplates } from "@/lib/whatsapp";

function playArrivalSound() {
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

type PendingArrival = {
  id: string;
  guestTitle: string;
  guestName: string;
  guestMobile: string;
  roomNumber: string;
  floor: number;
  checkInDate: string;
  numberOfGuests: number;
};

type CheckedInInfo = {
  guestTitle: string;
  guestName: string;
  guestMobile: string;
  roomNumber: string;
  checkInTime: string;
};

export function ArrivalCheckAlert() {
  const [queue, setQueue] = useState<PendingArrival[]>([]);
  const actedIdsRef = useRef<Set<string>>(new Set());
  const [mode, setMode] = useState<"confirm" | "delay" | "greeted">("confirm");
  const [newTime, setNewTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkedIn, setCheckedIn] = useState<CheckedInInfo | null>(null);
  const lastCurrentId = useRef<string | null>(null);
  const prevQueueLen = useRef(0);

  const current = queue[0] ?? null;

  useEffect(() => {
    if (queue.length > prevQueueLen.current) {
      playArrivalSound();
    }
    prevQueueLen.current = queue.length;
  }, [queue.length]);

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch("/api/bookings/pending-arrival");
      if (!res.ok) return;
      const data = await res.json();
      const arrivals: PendingArrival[] = data.bookings ?? [];
      setQueue((prev) => {
        const acted = actedIdsRef.current;
        const filtered = arrivals.filter((a) => !acted.has(a.id));
        const prevIds = new Set(prev.map((p) => p.id));
        const existing = prev.filter((p) => filtered.some((f) => f.id === p.id));
        const newItems = filtered.filter((f) => !prevIds.has(f.id));
        return [...existing, ...newItems];
      });
    } catch {}
  }, []);

  useEffect(() => {
    fetchPending();
    // The realtime check below already refetches whenever a booking or room
    // actually changes, so this timer is only a safety net. Two minutes (and
    // only while the app is on screen) instead of every 30 seconds.
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchPending();
    }, 120_000);
    return () => clearInterval(interval);
  }, [fetchPending]);

  useRealtime((kind) => {
    if (kind === "bookings-updated" || kind === "rooms-updated") {
      fetchPending();
    }
  });

  // Reset mode when displayed card changes (but not when entering greeted mode)
  useEffect(() => {
    if (current?.id !== lastCurrentId.current && mode !== "greeted") {
      lastCurrentId.current = current?.id ?? null;
      setMode("confirm");
      setNewTime("");
    }
  }, [current?.id, mode]);

  function markActed(id: string) {
    actedIdsRef.current.add(id);
    setQueue((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleCame() {
    if (!current || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${current.id}/checkin`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not check in guest");
        return;
      }
      // Save info for greeting screen before removing from queue
      setCheckedIn({
        guestTitle: current.guestTitle,
        guestName: current.guestName,
        guestMobile: current.guestMobile,
        roomNumber: current.roomNumber,
        checkInTime: formatDateTime(new Date()),
      });
      setMode("greeted");
      markActed(current.id);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelay() {
    if (!current || !newTime || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${current.id}/delay-arrival`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newTime }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not update arrival time");
        return;
      }
      toast.success(`Updated — will re-notify at ${newTime}`);
      setQueue((prev) => prev.filter((a) => a.id !== current.id));
      setMode("confirm");
      setNewTime("");
    } finally {
      setLoading(false);
    }
  }

  function dismissGreeting() {
    setCheckedIn(null);
    setMode("confirm");
    lastCurrentId.current = null;
  }

  // Show greeting screen even after queue item is removed
  if (mode === "greeted" && checkedIn) {
    const greetingMsg = whatsappTemplates.checkInGreeting({
      title: checkedIn.guestTitle,
      guestName: checkedIn.guestName,
      checkInTime: checkedIn.checkInTime,
      roomNumber: checkedIn.roomNumber,
    });

    return (
      <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
        <div className="relative w-full max-w-md rounded-2xl bg-card shadow-2xl ring-1 ring-border overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
          <div className="p-6 space-y-4">
            {/* Logo + confirmation header */}
            <div className="flex flex-col items-center gap-3 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.jpeg" alt="Hotel Logo" className="h-16 w-16 rounded-full object-cover shadow-md ring-2 ring-emerald-300" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                  Check-in Confirmed
                </p>
                <h2 className="text-xl font-bold leading-tight mt-0.5">{checkedIn.guestName}</h2>
                <p className="text-sm text-muted-foreground">
                  Room {checkedIn.roomNumber} · {checkedIn.checkInTime}
                </p>
              </div>
            </div>

            {/* Message preview */}
            <div className="rounded-lg border bg-muted/40 p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Greeting Preview</span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(greetingMsg).then(() => toast.success("Copied!"))}
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
              <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground font-sans max-h-40 overflow-y-auto">{greetingMsg}</pre>
            </div>

            <div className="space-y-2">
              <a
                href={buildWhatsAppLink(checkedIn.guestMobile, greetingMsg)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#20b858] transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                Send Check-in Greeting on WhatsApp
              </a>
              <Button variant="outline" className="w-full" onClick={dismissGreeting}>
                Done
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-md rounded-2xl bg-card shadow-2xl ring-1 ring-border overflow-hidden">
        {queue.length > 1 && (
          <div className="absolute top-3 right-3 rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-white shadow-sm">
            {queue.length} pending
          </div>
        )}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-amber-600" />
        <div className="p-6 space-y-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
            <Clock className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
            Guest Arrival — Confirmation Required
          </p>
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold leading-tight">{current.guestName}</h2>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <BedDouble className="h-3.5 w-3.5" />
                Room {current.roomNumber} · Floor {current.floor}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {current.numberOfGuests} guest{current.numberOfGuests === 1 ? "" : "s"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Scheduled: {formatDateTime(current.checkInDate)}
            </p>
          </div>

          {mode === "confirm" ? (
            <div className="space-y-2.5 pt-1">
              <p className="text-sm font-medium text-foreground">Has this guest arrived at the hotel?</p>
              <Button
                size="lg"
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700"
                onClick={handleCame}
                disabled={loading}
              >
                <CheckCircle2 className="h-5 w-5" />
                Yes, Guest Has Arrived
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full gap-2"
                onClick={() => setMode("delay")}
                disabled={loading}
              >
                <Clock className="h-5 w-5" />
                Not Arrived Yet — Set New Time
              </Button>
            </div>
          ) : (
            <div className="space-y-3 pt-1 text-left">
              <div className="space-y-1.5">
                <Label htmlFor="newArrivalTime" className="text-sm font-medium">
                  When is the guest expected to arrive?
                </Label>
                <Input
                  id="newArrivalTime"
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="text-base"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={() => { setMode("confirm"); setNewTime(""); }}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button onClick={handleDelay} disabled={loading || !newTime}>
                  Confirm New Time
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
