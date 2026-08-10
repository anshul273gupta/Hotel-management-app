"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Star, Loader2, Phone, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DARSHAN_ITINERARY } from "@/lib/darshan-itinerary";
import {
  SERVICE_REQUEST_TYPE_LABELS,
  SERVICE_REQUEST_TYPE_ICONS,
  SERVICE_REQUEST_STATUS_LABELS,
  SERVICE_REQUEST_STATUS_COLORS,
} from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import type { ServiceRequestType, ServiceRequestStatus } from "@/lib/types";

// TEMPLE_INFO opens an itinerary rather than raising a request, and CUSTOM
// existed only to collect free text, which guests no longer type.
const HIDDEN_TYPES: ServiceRequestType[] = ["CUSTOM"];
const REQUEST_TYPES = (Object.keys(SERVICE_REQUEST_TYPE_LABELS) as ServiceRequestType[])
  .filter((t) => !HIDDEN_TYPES.includes(t));

/**
 * Number guests are asked to ring for taxis and transport.
 *
 * Deliberately separate from the reception number: taxi enquiries go to the
 * owner's mobile, which is not always the number on the reception desk.
 * NEXT_PUBLIC_ is required for the value to be readable in the browser.
 */
const TAXI_CONTACT_NUMBER =
  process.env.NEXT_PUBLIC_TAXI_PHONE?.trim() || "9406851411";

/** Builds a `tel:` link from a phone number, assuming 10-digit numbers are Indian (+91). */
function buildTelLink(phone: string): string | null {
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return null;
  return `tel:+${digits.length === 10 ? `91${digits}` : digits}`;
}

type GuestRequest = {
  id: string;
  type: ServiceRequestType;
  description: string | null;
  status: ServiceRequestStatus;
  rating: number | null;
  ratingComment: string | null;
  createdAt: string;
};

function storageKey(roomToken: string) {
  return `hotel-guest-requests-${roomToken}`;
}

export function ServiceRequestPage({
  roomToken,
  roomNumber,
  hotelName,
  receptionPhone,
  wifiName,
  wifiPassword,
  housekeepingOpen,
  housekeepingNextWindow,
}: {
  roomToken: string;
  roomNumber: string;
  hotelName: string;
  receptionPhone: string;
  /** Shown so guests can get online without asking reception. */
  wifiName: string;
  wifiPassword: string;
  /** Housekeeping runs two shifts a day; requests outside them are declined. */
  housekeepingOpen: boolean;
  housekeepingNextWindow: string;
}) {
  const [selectedType, setSelectedType] = useState<ServiceRequestType | null>(null);
  const [showTempleInfo, setShowTempleInfo] = useState(false);
  const [showTaxiInfo, setShowTaxiInfo] = useState(false);
  const [wifiCopied, setWifiCopied] = useState(false);
  const [description, setDescription] = useState("");

  // Tea & Coffee — separate qty for each, managed outside dialog
  const [showTeaCoffee, setShowTeaCoffee] = useState(false);
  const [teaQty, setTeaQty] = useState(0);
  const [coffeeQty, setCoffeeQty] = useState(0);
  const [tcNotes, setTcNotes] = useState("");
  const [tcSubmitting, setTcSubmitting] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [ratingSubmitting, setRatingSubmitting] = useState<Set<string>>(new Set());
  const [myRequestIds, setMyRequestIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(storageKey(roomToken));
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [myRequests, setMyRequests] = useState<GuestRequest[]>([]);

  useEffect(() => {
    if (myRequestIds.length === 0) return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/guest/service-requests?roomToken=${roomToken}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const mine = (data.requests as GuestRequest[]).filter((r) => myRequestIds.includes(r.id));
        setMyRequests(mine);
      } catch {}
    }
    poll();
    const interval = setInterval(poll, 8000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [roomToken, myRequestIds]);

  function openRequest(type: ServiceRequestType) {
    if (type === "CALL_RECEPTION") { callReception(); return; }
    // Darshan details are information, not something reception acts on.
    if (type === "TEMPLE_INFO") { setShowTempleInfo(true); return; }
    // Taxis are arranged over the phone, so this shows the number to call
    // rather than raising a request nobody would action.
    if (type === "TAXI_BOOKING") { setShowTaxiInfo(true); return; }
    if (type === "TEA_COFFEE") {
      setTeaQty(0);
      setCoffeeQty(0);
      setTcNotes("");
      setShowTeaCoffee(true);
      return;
    }
    setSelectedType(type);
    setDescription("");
  }

  async function copyWifiPassword() {
    try {
      await navigator.clipboard.writeText(wifiPassword);
      setWifiCopied(true);
      toast.success("WiFi password copied");
      setTimeout(() => setWifiCopied(false), 2000);
    } catch {
      // Clipboard is blocked on insecure origins and some in-app browsers;
      // the password is on screen either way.
      toast.error("Couldn't copy — please type it in");
    }
  }

  function callReception() {
    const telLink = buildTelLink(receptionPhone);
    if (!telLink) { toast.error("Reception number is not available right now."); return; }
    const formData = new FormData();
    formData.set("roomToken", roomToken);
    formData.set("type", "CALL_RECEPTION");
    fetch("/api/guest/service-requests", { method: "POST", body: formData }).catch(() => {});
    window.location.assign(telLink);
  }

  async function submitTeaCoffee() {
    if (teaQty === 0 && coffeeQty === 0) {
      toast.error("Please add at least one item");
      return;
    }
    setTcSubmitting(true);
    try {
      const items: string[] = [];
      if (teaQty > 0) items.push(`${teaQty}× Tea`);
      if (coffeeQty > 0) items.push(`${coffeeQty}× Coffee`);
      const desc = [items.join(", "), tcNotes.trim()].filter(Boolean).join(" — ");

      const formData = new FormData();
      formData.set("roomToken", roomToken);
      formData.set("type", "TEA_COFFEE");
      if (desc) formData.set("description", desc);

      const res = await fetch("/api/guest/service-requests", { method: "POST", body: formData });
      if (!res.ok) { toast.error("Could not send your request. Please try again."); return; }
      const data = await res.json();
      const newIds = [data.request.id, ...myRequestIds].slice(0, 20);
      setMyRequestIds(newIds);
      localStorage.setItem(storageKey(roomToken), JSON.stringify(newIds));
      toast.success("Request sent! Our staff will assist you shortly.");
      setShowTeaCoffee(false);
    } finally {
      setTcSubmitting(false);
    }
  }

  async function submitRequest() {
    if (!selectedType) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("roomToken", roomToken);
      formData.set("type", selectedType);
      if (description.trim()) formData.set("description", description.trim());
      const res = await fetch("/api/guest/service-requests", { method: "POST", body: formData });
      if (!res.ok) { toast.error("Could not send your request. Please try again."); return; }
      const data = await res.json();
      const newIds = [data.request.id, ...myRequestIds].slice(0, 20);
      setMyRequestIds(newIds);
      localStorage.setItem(storageKey(roomToken), JSON.stringify(newIds));
      toast.success("Request sent! Our staff will assist you shortly.");
      setSelectedType(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitRating(requestId: string, rating: number) {
    if (ratingSubmitting.has(requestId)) return;
    setRatingSubmitting((prev) => new Set(prev).add(requestId));
    try {
      const res = await fetch(`/api/guest/service-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, roomToken }),
      });
      if (!res.ok) { toast.error("Could not submit rating"); return; }
      toast.success("Thanks for your feedback!");
      setMyRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, rating } : r)));
    } finally {
      setRatingSubmitting((prev) => { const s = new Set(prev); s.delete(requestId); return s; });
    }
  }

  const pastelPinkVars = {
    "--background": "oklch(0.96 0.02 350)",
    "--foreground": "oklch(0.25 0.05 350)",
    "--card": "oklch(0.99 0.01 350)",
    "--card-foreground": "oklch(0.25 0.05 350)",
    "--popover": "oklch(0.99 0.01 350)",
    "--popover-foreground": "oklch(0.25 0.05 350)",
    "--primary": "oklch(0.65 0.18 350)",
    "--primary-foreground": "oklch(0.99 0.005 350)",
    "--secondary": "oklch(0.93 0.03 350)",
    "--secondary-foreground": "oklch(0.35 0.06 350)",
    "--muted": "oklch(0.94 0.02 350)",
    "--muted-foreground": "oklch(0.50 0.04 350)",
    "--accent": "oklch(0.90 0.05 350)",
    "--accent-foreground": "oklch(0.30 0.06 350)",
    "--border": "oklch(0.90 0.03 350)",
    "--input": "oklch(0.90 0.03 350)",
    "--ring": "oklch(0.65 0.18 350)",
    "--destructive": "oklch(0.6 0.21 25)",
  } as React.CSSProperties;

  return (
    <main className="min-h-screen bg-background px-4 py-8" style={pastelPinkVars}>
      <div className="mx-auto max-w-lg space-y-6">
        <div className="text-center">
          <div className="relative mx-auto mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl shadow-md ring-2 ring-primary/20">
            <Image src="/logo.jpeg" alt="" fill className="object-cover" />
          </div>
          <p className="font-display text-lg font-semibold tracking-tight text-foreground">{hotelName}</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Room {roomNumber}</h1>
          <p className="text-sm text-muted-foreground">How can we help you today?</p>
        </div>

        {/* WiFi details, so guests can get online without ringing reception. */}
        {wifiPassword && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="px-4 py-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none">📶</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">Stay connected, stay blessed</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Free WiFi for our guests — share your Ujjain moments.
                  </p>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-background/70 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Network
                        </p>
                        <p className="truncate font-medium text-foreground">{wifiName}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 rounded-lg bg-background/70 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Password
                        </p>
                        <p className="truncate font-mono text-base font-semibold tracking-wider text-foreground">
                          {wifiPassword}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={copyWifiPassword}
                        className="shrink-0 rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary active:scale-95"
                      >
                        {wifiCopied ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tea & Coffee inline panel — shown instead of dialog */}
        {showTeaCoffee && (
          <Card className="border-primary/20">
            <CardContent className="space-y-4 px-4 py-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-foreground">☕ Tea / Coffee Order</p>
                <button
                  type="button"
                  onClick={() => setShowTeaCoffee(false)}
                  className="rounded-full p-1 hover:bg-muted"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {/* Tea row */}
              <div className="flex items-center justify-between rounded-xl border border-input bg-background px-4 py-3">
                <span className="text-base font-medium">🍵 Tea</span>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setTeaQty((q) => Math.max(0, q - 1))}
                    disabled={teaQty <= 0}
                    style={{
                      width: 36, height: 36, borderRadius: "50%",
                      border: "1px solid #ccc", background: "#fff",
                      fontSize: 20, cursor: teaQty <= 0 ? "not-allowed" : "pointer",
                      opacity: teaQty <= 0 ? 0.4 : 1,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    −
                  </button>
                  <span style={{ width: 28, textAlign: "center", fontSize: 18, fontWeight: 700 }}>{teaQty}</span>
                  <button
                    type="button"
                    onClick={() => setTeaQty((q) => Math.min(10, q + 1))}
                    disabled={teaQty >= 10}
                    style={{
                      width: 36, height: 36, borderRadius: "50%",
                      border: "1px solid #ccc", background: "#fff",
                      fontSize: 20, cursor: teaQty >= 10 ? "not-allowed" : "pointer",
                      opacity: teaQty >= 10 ? 0.4 : 1,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Coffee row */}
              <div className="flex items-center justify-between rounded-xl border border-input bg-background px-4 py-3">
                <span className="text-base font-medium">☕ Coffee</span>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setCoffeeQty((q) => Math.max(0, q - 1))}
                    disabled={coffeeQty <= 0}
                    style={{
                      width: 36, height: 36, borderRadius: "50%",
                      border: "1px solid #ccc", background: "#fff",
                      fontSize: 20, cursor: coffeeQty <= 0 ? "not-allowed" : "pointer",
                      opacity: coffeeQty <= 0 ? 0.4 : 1,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    −
                  </button>
                  <span style={{ width: 28, textAlign: "center", fontSize: 18, fontWeight: 700 }}>{coffeeQty}</span>
                  <button
                    type="button"
                    onClick={() => setCoffeeQty((q) => Math.min(10, q + 1))}
                    disabled={coffeeQty >= 10}
                    style={{
                      width: 36, height: 36, borderRadius: "50%",
                      border: "1px solid #ccc", background: "#fff",
                      fontSize: 20, cursor: coffeeQty >= 10 ? "not-allowed" : "pointer",
                      opacity: coffeeQty >= 10 ? 0.4 : 1,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              <Button
                onClick={submitTeaCoffee}
                disabled={tcSubmitting || (teaQty === 0 && coffeeQty === 0)}
                className="w-full gap-2"
              >
                {tcSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send Order
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3">
          {REQUEST_TYPES.map((type) => {
            // Housekeeping only runs during its two daily shifts. Show the
            // tile greyed out with the next window rather than hiding it, so
            // guests know the service exists and when to come back.
            const closed = type === "HOUSEKEEPING" && !housekeepingOpen;
            return (
              <button
                key={type}
                type="button"
                disabled={closed}
                onClick={() => openRequest(type)}
                className="text-left disabled:cursor-not-allowed"
              >
                <Card
                  className={
                    closed
                      ? "h-full border-primary/10 opacity-60"
                      : "h-full border-primary/10 transition-colors hover:bg-primary/5 active:scale-[0.98]"
                  }
                >
                  <CardContent className="flex flex-col items-center gap-2 px-3 py-5 text-center">
                    <span className="text-3xl">{SERVICE_REQUEST_TYPE_ICONS[type]}</span>
                    <span className="text-sm font-medium text-foreground">{SERVICE_REQUEST_TYPE_LABELS[type]}</span>
                    {closed && (
                      <span className="text-[11px] leading-tight text-muted-foreground">
                        Available {housekeepingNextWindow}
                      </span>
                    )}
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>

        {myRequests.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">Your Requests</h2>
            <div className="space-y-2">
              {myRequests.map((req) => (
                <Card key={req.id}>
                  <CardContent className="space-y-2 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {SERVICE_REQUEST_TYPE_ICONS[req.type]} {SERVICE_REQUEST_TYPE_LABELS[req.type]}
                        </p>
                        {req.description && (
                          <p className="text-xs text-muted-foreground">{req.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{timeAgo(req.createdAt)}</p>
                      </div>
                      <Badge className={SERVICE_REQUEST_STATUS_COLORS[req.status]}>
                        {SERVICE_REQUEST_STATUS_LABELS[req.status]}
                      </Badge>
                    </div>
                    {req.status === "COMPLETED" && req.rating === null && (
                      <div className="flex items-center gap-1 border-t pt-2">
                        <span className="mr-1 text-xs text-muted-foreground">Rate this:</span>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => submitRating(req.id, star)}
                            disabled={ratingSubmitting.has(req.id)}
                            aria-label={`Rate ${star} stars`}
                          >
                            <Star className="h-4 w-4 text-amber-400 hover:fill-amber-400" />
                          </button>
                        ))}
                      </div>
                    )}
                    {req.rating !== null && (
                      <div className="flex items-center gap-0.5 border-t pt-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${star <= req.rating! ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dialog for all request types except TEA_COFFEE */}
      <Dialog open={showTempleInfo} onOpenChange={setShowTempleInfo}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>🛕 Temple Darshan Information</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {DARSHAN_ITINERARY.map((day) => (
              <div key={day.title} className="space-y-2">
                <p className="text-sm font-semibold text-foreground">{day.title}</p>
                {day.stops.map((stop) => (
                  <div key={stop.time} className="rounded-lg border border-primary/10 px-3 py-2">
                    <p className="text-xs font-medium text-primary">{stop.time}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-foreground">{stop.detail}</p>
                  </div>
                ))}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Timings are a suggestion and may vary. Please call reception if you would like help
              arranging a taxi.
            </p>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => setShowTempleInfo(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/*
        Taxis are arranged by phone, so this replaces the "Send Request" flow
        with the number to call. The number is a tel: link — on a phone it
        dials, which saves the guest copying it out by hand.
      */}
      <Dialog open={showTaxiInfo} onOpenChange={setShowTaxiInfo}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>🚕 Taxi Booking Assistance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-foreground">
              For taxi bookings or any information related to Omkareshwar transport or any
              other transport, please feel free to contact us at the mobile number provided
              below.
            </p>

            {(() => {
              const telLink = buildTelLink(TAXI_CONTACT_NUMBER);
              const numberText = (
                <span className="font-mono text-xl font-semibold tracking-wider text-foreground">
                  {TAXI_CONTACT_NUMBER}
                </span>
              );
              return telLink ? (
                <a
                  href={telLink}
                  className="flex items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 transition-colors hover:bg-primary/10"
                >
                  <Phone className="h-4 w-4 shrink-0 text-primary" />
                  {numberText}
                </a>
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-primary/20 bg-primary/5 px-3 py-3">
                  {numberText}
                </div>
              );
            })()}

            <p className="text-sm leading-relaxed text-muted-foreground">
              ✨ We&apos;ll be happy to assist you and make your journey comfortable and
              convenient.
            </p>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => setShowTaxiInfo(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedType !== null}
        onOpenChange={(open) => { if (!open) setSelectedType(null); }}
      >
        <DialogContent>
          {selectedType && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {SERVICE_REQUEST_TYPE_ICONS[selectedType]} {SERVICE_REQUEST_TYPE_LABELS[selectedType]}
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Reception will be notified straight away.
              </p>
              <DialogFooter>
                <Button onClick={submitRequest} disabled={submitting} className="w-full gap-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send Request
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
