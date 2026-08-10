"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";

export type EditableBooking = {
  id: string;
  status: string;
  numberOfGuests: number;
  roomRate: number;
  totalAmount: number;
  amountPaid: number;
  checkInDate: string | Date;
  expectedCheckOut: string | Date;
  notes?: string | null;
  roomNumber: string;
  /** Needed to preselect the room list; older callers may not pass it. */
  roomId?: string;
  guest: { name: string; mobile: string | null; address?: string | null };
};

type RoomOption = {
  id: string;
  number: string;
  type: string;
  basePrice: number | string;
  status: string;
  maintenanceStatus: string;
};

/** `datetime-local` needs local wall-clock time, not the UTC ISO string. */
function toLocalInput(value: string | Date) {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nights(from: string, to: string) {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 1;
  return Math.max(1, Math.ceil((b - a) / (1000 * 60 * 60 * 24)));
}

export function EditBookingDialog({
  booking,
  trigger,
}: {
  booking: EditableBooking;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const [guestName, setGuestName] = useState(booking.guest.name);
  const [mobile, setMobile] = useState(booking.guest.mobile ?? "");
  const [address, setAddress] = useState(booking.guest.address ?? "");
  const [numberOfGuests, setNumberOfGuests] = useState(String(booking.numberOfGuests));
  const [roomRate, setRoomRate] = useState(String(booking.roomRate));
  const [checkIn, setCheckIn] = useState(toLocalInput(booking.checkInDate));
  const [checkOut, setCheckOut] = useState(toLocalInput(booking.expectedCheckOut));
  const [notes, setNotes] = useState(booking.notes ?? "");
  const [roomId, setRoomId] = useState(booking.roomId ?? "");
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [extraPayment, setExtraPayment] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");

  /**
   * Rooms are fetched when the dialog opens rather than with the page: the
   * list is only needed if someone actually edits, and the guest history sheet
   * can render many of these dialogs at once.
   */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/rooms")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.rooms) return;
        setRooms(data.rooms as RoomOption[]);
      })
      .catch(() => {
        // Non-fatal: without the list the room simply can't be changed.
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Check-in can only move while the guest hasn't arrived yet.
  const checkInLocked = booking.status !== "RESERVED";
  const canCancel = booking.status === "RESERVED" || booking.status === "CHECKED_IN";

  const newTotal = (Number(roomRate) || 0) * nights(checkIn, checkOut);
  const extra = Math.max(0, Number(extraPayment) || 0);
  const paidAfter = booking.amountPaid + extra;
  const refundDue = Math.max(0, paidAfter - newTotal);
  const stillDue = Math.max(0, newTotal - paidAfter);
  /** What can still be collected — the cap on the extra-payment box. */
  const outstanding = Math.max(0, newTotal - booking.amountPaid);
  const overPaying = extra > 0 && extra > outstanding;

  /**
   * Rooms offered for a move: the current one, plus any that are free.
   * Housekeeping state is deliberately not filtered out — staff move guests
   * into a just-vacated room all the time and know better than the app.
   */
  const roomChoices = useMemo(() => {
    return rooms.filter(
      (r) =>
        r.id === booking.roomId ||
        (r.maintenanceStatus !== "UNDER_MAINTENANCE" && r.status !== "OCCUPIED"),
    );
  }, [rooms, booking.roomId]);

  const selectedRoom = rooms.find((r) => r.id === roomId);
  const roomMoved = Boolean(booking.roomId) && roomId !== booking.roomId;

  async function save() {
    // Caught here as well as on the server so the guest isn't credited more
    // than they owe by a stray extra digit.
    if (overPaying) {
      toast.error(`Only ${formatCurrency(outstanding)} is outstanding on this booking.`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName,
          mobile,
          address,
          numberOfGuests,
          roomRate,
          ...(roomMoved ? { roomId } : {}),
          ...(extra > 0 ? { additionalPayment: extra, paymentMethod } : {}),
          ...(checkInLocked ? {} : { checkInDate: checkIn }),
          expectedCheckOut: checkOut,
          notes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = data.error;
        const message =
          typeof err === "string"
            ? err
            : Object.values(err ?? {})
                .flat()
                .join(" ") || "Could not save the changes";
        toast.error(message);
        return;
      }
      const parts: string[] = [];
      if (data.movedFromRoom) {
        parts.push(`moved from Room ${data.movedFromRoom} to Room ${data.booking?.roomNumber}`);
      }
      if (extra > 0) parts.push(`${formatCurrency(extra)} payment recorded`);
      if (data.refundDue > 0) parts.push(`${formatCurrency(data.refundDue)} refund due to the guest`);
      toast.success(parts.length ? `Booking updated — ${parts.join(", ")}` : "Booking updated");

      setExtraPayment("");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelBooking() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not cancel the booking");
        return;
      }
      toast.success(
        data.refundDue > 0
          ? `Booking cancelled — ${formatCurrency(data.refundDue)} already paid, refund due`
          : "Booking cancelled",
      );
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setConfirmText(""); }}>
      <DialogTrigger
        render={
          trigger ? (
            <span />
          ) : (
            <Button variant="outline" size="sm" className="w-full gap-1.5" />
          )
        }
      >
        {trigger ?? (
          <>
            <Pencil className="h-3.5 w-3.5" />
            Edit Booking
          </>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Booking — Room {booking.roomNumber}</DialogTitle>
          <DialogDescription>
            The total is recalculated from the rate and the number of nights.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="eb-name">Guest Name *</Label>
            <Input id="eb-name" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="eb-mobile">
                Mobile <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="eb-mobile"
                inputMode="numeric"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eb-guests">Guests</Label>
              <Input
                id="eb-guests"
                type="number"
                min={1}
                max={20}
                value={numberOfGuests}
                onChange={(e) => setNumberOfGuests(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="eb-address">
              Address <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input id="eb-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="eb-checkin">
              Check-in
              {checkInLocked && (
                <span className="ml-1 font-normal text-muted-foreground">
                  (locked — guest has arrived)
                </span>
              )}
            </Label>
            <Input
              id="eb-checkin"
              type="datetime-local"
              value={checkIn}
              disabled={checkInLocked}
              onChange={(e) => setCheckIn(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="eb-checkout">Check-out *</Label>
            <Input
              id="eb-checkout"
              type="datetime-local"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </div>

          {/*
            Guests get moved for maintenance, noise or an upgrade, and the
            wrong room is sometimes picked at check-in. Works whether the stay
            is still reserved or the guest has already arrived.
          */}
          {booking.roomId && roomChoices.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="eb-room">Room *</Label>
              <select
                id="eb-room"
                value={roomId}
                onChange={(e) => {
                  const next = e.target.value;
                  setRoomId(next);
                  // Offer the new room's standard rate, but only when the
                  // current rate hasn't been hand-adjusted away from it.
                  const from = rooms.find((r) => r.id === booking.roomId);
                  const to = rooms.find((r) => r.id === next);
                  if (to && (!from || Number(roomRate) === Number(from.basePrice))) {
                    setRoomRate(String(Number(to.basePrice)));
                  }
                }}
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
              >
                {roomChoices.map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.number} — {r.type}
                    {r.id === booking.roomId ? " (current)" : ""}
                  </option>
                ))}
              </select>
              {roomMoved && selectedRoom && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Moving from Room {booking.roomNumber} to Room {selectedRoom.number}.
                  {booking.status === "CHECKED_IN"
                    ? " Room availability updates for both rooms on save."
                    : ""}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="eb-rate">Room Rate (per night) *</Label>
            <Input
              id="eb-rate"
              type="number"
              min={0}
              value={roomRate}
              onChange={(e) => setRoomRate(e.target.value)}
            />
          </div>

          {/*
            Adds to what has already been received rather than overwriting it,
            so each amount collected stays in the payment history and lands in
            revenue on the day it was actually taken.
          */}
          {outstanding > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="eb-extra">
                Collect Payment{" "}
                <span className="font-normal text-muted-foreground">
                  (optional — {formatCurrency(outstanding)} outstanding)
                </span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="eb-extra"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  value={extraPayment}
                  onChange={(e) => setExtraPayment(e.target.value)}
                  className="flex-1"
                />
                <select
                  aria-label="Payment method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="h-9 rounded-lg border bg-background px-2 text-sm"
                >
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {overPaying ? (
                <p className="text-xs text-destructive">
                  That is more than the {formatCurrency(outstanding)} outstanding.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => setExtraPayment(String(outstanding))}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Collect full balance ({formatCurrency(outstanding)})
                </button>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="eb-notes">
              Notes <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input id="eb-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {nights(checkIn, checkOut)} night(s) × {formatCurrency(Number(roomRate) || 0)}
              </span>
              <span className="font-semibold">{formatCurrency(newTotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Already paid</span>
              <span>{formatCurrency(booking.amountPaid)}</span>
            </div>
            {extra > 0 && (
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                <span>Collecting now</span>
                <span>+{formatCurrency(extra)}</span>
              </div>
            )}
            {refundDue > 0 && (
              <p className="mt-1 font-medium text-amber-700 dark:text-amber-500">
                Refund due to guest: {formatCurrency(refundDue)}
              </p>
            )}
            {stillDue > 0 && (
              <p className="mt-1 font-medium text-rose-700 dark:text-rose-400">
                Balance to collect: {formatCurrency(stillDue)}
              </p>
            )}
          </div>

          {canCancel && (
            <div className="rounded-lg border border-destructive/30 px-3 py-2.5">
              <p className="text-sm font-medium text-destructive">Cancel this booking</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                The room is freed immediately. Payments already recorded are kept for your
                records{booking.amountPaid > 0 ? ` — ${formatCurrency(booking.amountPaid)} would need refunding` : ""}.
                Type <span className="font-mono font-semibold">CANCEL</span> to confirm.
              </p>
              <div className="mt-2 flex gap-2">
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="CANCEL"
                  className="h-9"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  disabled={confirmText !== "CANCEL" || cancelling}
                  onClick={cancelBooking}
                >
                  {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Cancel Booking
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
          <Button onClick={save} disabled={saving || !guestName.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
