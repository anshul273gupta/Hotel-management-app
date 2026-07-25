"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Star, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  SERVICE_REQUEST_TYPE_LABELS,
  SERVICE_REQUEST_TYPE_ICONS,
  SERVICE_REQUEST_STATUS_LABELS,
  SERVICE_REQUEST_STATUS_COLORS,
} from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import type { ServiceRequestType, ServiceRequestStatus } from "@/lib/types";

const REQUEST_TYPES = Object.keys(SERVICE_REQUEST_TYPE_LABELS) as ServiceRequestType[];

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
}: {
  roomToken: string;
  roomNumber: string;
  hotelName: string;
  receptionPhone: string;
}) {
  const [selectedType, setSelectedType] = useState<ServiceRequestType | null>(null);
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
    if (selectedType === "CUSTOM" && !description.trim()) {
      toast.error("Please describe your request");
      return;
    }
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

              <div className="space-y-1.5">
                <Label htmlFor="tc-notes">Additional notes (optional)</Label>
                <Textarea
                  id="tc-notes"
                  rows={2}
                  placeholder="E.g. extra sugar, no milk..."
                  value={tcNotes}
                  onChange={(e) => setTcNotes(e.target.value)}
                />
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
          {REQUEST_TYPES.map((type) => (
            <button key={type} type="button" onClick={() => openRequest(type)} className="text-left">
              <Card className="h-full border-primary/10 transition-colors hover:bg-primary/5 active:scale-[0.98]">
                <CardContent className="flex flex-col items-center gap-2 px-3 py-5 text-center">
                  <span className="text-3xl">{SERVICE_REQUEST_TYPE_ICONS[type]}</span>
                  <span className="text-sm font-medium text-foreground">{SERVICE_REQUEST_TYPE_LABELS[type]}</span>
                </CardContent>
              </Card>
            </button>
          ))}
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
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="description">
                    {selectedType === "CUSTOM" ? "Tell us what you need" : "Additional notes (optional)"}
                  </Label>
                  <Textarea
                    id="description"
                    rows={3}
                    placeholder={selectedType === "CUSTOM" ? "E.g. need an extra pillow and a hairdryer" : "Any extra details..."}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
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
