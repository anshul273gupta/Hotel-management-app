"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarRange,
  CreditCard,
  IdCard,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  MessageCircle,
  NotebookText,
  Phone,
  User,
  UserPlus,
  Wrench,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  ROOM_STATUS_LABELS,
  ROOM_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
} from "@/lib/constants";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/format";
import { buildWhatsAppLink, whatsappTemplates } from "@/lib/whatsapp";
import type { RoomWithCurrentBooking } from "@/lib/rooms";

export function RoomCard({ room }: { room: RoomWithCurrentBooking }) {
  const router = useRouter();
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [togglingMaintenance, setTogglingMaintenance] = useState(false);
  const [checkOutDone, setCheckOutDone] = useState<{ guestName: string; mobile: string | null; time: string } | null>(null);
  const colors = ROOM_STATUS_COLORS[room.status];
  const paymentDue = room.currentBooking && room.currentBooking.paymentStatus !== "PAID";

  async function handleToggleMaintenance() {
    const goingToMaintenance = room.status !== "MAINTENANCE";
    setTogglingMaintenance(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maintenanceStatus: goingToMaintenance ? "UNDER_MAINTENANCE" : "OK" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not update room status");
        return;
      }
      toast.success(`Room ${room.number} set to ${goingToMaintenance ? "Maintenance" : "Available"}`);
      router.refresh();
    } catch {
      toast.error("Server not reachable — please refresh the page and try again");
    } finally {
      setTogglingMaintenance(false);
    }
  }

  async function handleCheckOut() {
    if (!room.currentBooking) return;
    setCheckingOut(true);
    try {
      const res = await fetch(`/api/bookings/${room.currentBooking.id}/checkout`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not check out");
        return;
      }
      const checkOutTime = data.booking?.actualCheckOut
        ? formatDateTime(data.booking.actualCheckOut)
        : formatDateTime(new Date());
      setCheckOutDone({
        guestName: room.currentBooking.guest.name,
        mobile: room.currentBooking.guest.mobile,
        time: checkOutTime,
      });
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setCheckingOut(false);
    }
  }

  async function handleCheckIn() {
    if (!room.reservedBooking) return;
    setCheckingIn(true);
    try {
      const res = await fetch(`/api/bookings/${room.reservedBooking.id}/checkin`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not check in guest");
        return;
      }
      toast.success(`${room.reservedBooking.guest.name} checked into Room ${room.number}`);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setCheckingIn(false);
    }
  }

  return (
    <Card
      className={`border ${colors.border} ${colors.bg} ${
        paymentDue ? "ring-2 ring-red-500 dark:ring-red-400" : ""
      }`}
    >
      <CardContent className="space-y-3 p-4">
        {/* ── Room info + guest detail dialog ── */}
        <Dialog>
          <DialogTrigger render={<div className="cursor-pointer space-y-3" />}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-xl font-semibold leading-none">{room.number}</p>
                <p className="text-xs text-muted-foreground">Floor {room.floor}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {paymentDue && (
                  <Badge className="border-0 bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300">
                    <CreditCard className="mr-1 h-3 w-3" /> Payment Due
                  </Badge>
                )}
                <Badge className={`${colors.bg} ${colors.text} border-0`}>
                  <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${colors.dot}`} />
                  {ROOM_STATUS_LABELS[room.status]}
                </Badge>
              </div>
            </div>

            {room.currentBooking ? (
              <div className="space-y-1 rounded-lg bg-background/60 p-2.5 text-xs">
                <p className="flex items-center gap-1.5 font-medium">
                  <User className="h-3.5 w-3.5" /> {room.currentBooking.guest.name}
                </p>
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <CalendarRange className="h-3.5 w-3.5" />
                  {formatDate(room.currentBooking.checkInDate)} → {formatDate(room.currentBooking.expectedCheckOut)}
                </p>
              </div>
            ) : room.reservedBooking ? (
              <div className="space-y-1 rounded-lg bg-pink-100/60 p-2.5 text-xs dark:bg-pink-950/30">
                <p className="flex items-center gap-1.5 font-medium text-pink-800 dark:text-pink-300">
                  <User className="h-3.5 w-3.5" /> {room.reservedBooking.guest.name}
                </p>
                <p className="flex items-center gap-1.5 text-pink-700 dark:text-pink-400">
                  <CalendarRange className="h-3.5 w-3.5" />
                  Check-in: {formatDateTime(room.reservedBooking.checkInDate)}
                </p>
              </div>
            ) : (
              <p className="rounded-lg bg-background/60 p-2.5 text-xs text-muted-foreground">
                No current guest
              </p>
            )}
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Room {room.number}
                {room.currentBooking
                  ? ` — ${room.currentBooking.guest.name}`
                  : room.reservedBooking
                  ? ` — ${room.reservedBooking.guest.name} (Reserved)`
                  : ""}
              </DialogTitle>
              <DialogDescription>
                {room.currentBooking
                  ? "Guest details for the current stay"
                  : room.reservedBooking
                  ? "Upcoming reservation details"
                  : "No guest is currently staying in this room"}
              </DialogDescription>
            </DialogHeader>

            {(room.currentBooking ?? room.reservedBooking) && (() => {
              const b = room.currentBooking ?? room.reservedBooking!;
              return (
                <div className="space-y-2 text-sm">
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" /> {b.guest.mobile ?? "—"}
                  </p>
                  {b.guest.address && (
                    <p className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" /> {b.guest.address}
                    </p>
                  )}
                  {b.guest.idProofType && (
                    <p className="flex items-center gap-2">
                      <IdCard className="h-4 w-4 text-muted-foreground" />
                      {b.guest.idProofType}
                      {b.guest.idProofNumber ? ` — ${b.guest.idProofNumber}` : ""}
                    </p>
                  )}
                  <p className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {b.numberOfGuests} guest{b.numberOfGuests === 1 ? "" : "s"}
                  </p>
                  <p className="flex items-center gap-2">
                    <CalendarRange className="h-4 w-4 text-muted-foreground" />
                    {formatDateTime(b.checkInDate)} → {formatDateTime(b.expectedCheckOut)}
                  </p>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      Payment
                      <Badge className={`${PAYMENT_STATUS_COLORS[b.paymentStatus]} border-0 ml-auto`}>
                        {PAYMENT_STATUS_LABELS[b.paymentStatus]}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Total</span>
                        <span>{formatCurrency(b.totalAmount)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Paid</span>
                        <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(b.amountPaid)}</span>
                      </div>
                      {b.totalAmount - b.amountPaid > 0 && (
                        <div className="flex justify-between border-t pt-1.5 font-semibold">
                          <span className="text-red-600 dark:text-red-400">Pending</span>
                          <span className="text-red-600 dark:text-red-400">
                            {formatCurrency(b.totalAmount - b.amountPaid)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {b.guest.specialRequests && (
                    <p className="flex items-start gap-2">
                      <NotebookText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      {b.guest.specialRequests}
                    </p>
                  )}
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* ── Check-out button (OCCUPIED rooms) ── */}
        {room.currentBooking && (
          <Dialog onOpenChange={(open) => { if (!open) setCheckOutDone(null); }}>
            <DialogTrigger render={<Button variant="outline" size="sm" className="w-full gap-1.5" />}>
              <LogOut className="h-3.5 w-3.5" />
              Check Out
            </DialogTrigger>
            <DialogContent>
              {checkOutDone ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Check-out Complete</DialogTitle>
                    <DialogDescription>
                      {checkOutDone.guestName} has been checked out of Room {room.number}.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col gap-2 pt-2">
                    {/* Only offer the greeting when we have a number to send it to. */}
                    {checkOutDone.mobile && (
                    <a
                      href={buildWhatsAppLink(
                        checkOutDone.mobile,
                        whatsappTemplates.checkOutGreeting({
                          guestName: checkOutDone.guestName,
                          checkOutTime: checkOutDone.time,
                        }),
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#20b858] transition-colors"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Send Check-out Greeting on WhatsApp
                    </a>
                    )}
                  </div>
                  <DialogFooter>
                    <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Check out Room {room.number}?</DialogTitle>
                    <DialogDescription>
                      {room.currentBooking.guest.name} will be marked as checked out and the room will be set to available.
                      {room.currentBooking.paymentStatus !== "PAID" && (
                        <>
                          {" "}
                          Outstanding balance:{" "}
                          {formatCurrency(room.currentBooking.totalAmount - room.currentBooking.amountPaid)}.
                        </>
                      )}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                    <Button onClick={handleCheckOut} disabled={checkingOut} className="gap-1.5">
                      {checkingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                      Confirm Check-out
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        )}

        {/* ── Check-in button (RESERVED rooms) ── */}
        {room.reservedBooking && !room.currentBooking && (
          <Button
            size="sm"
            className="w-full gap-1.5 bg-pink-600 hover:bg-pink-700 text-white dark:bg-pink-600 dark:hover:bg-pink-700"
            onClick={handleCheckIn}
            disabled={checkingIn}
          >
            {checkingIn ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
            Check In Guest
          </Button>
        )}

        {/* ── Free room: occupy it, or bring it back from maintenance ── */}
        {!room.currentBooking && !room.reservedBooking && (
          room.status === "MAINTENANCE" ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-950/40"
              onClick={handleToggleMaintenance}
              disabled={togglingMaintenance}
            >
              {togglingMaintenance ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
              Mark as Available
            </Button>
          ) : (
            <div className="flex flex-col gap-1.5">
              {/* A room only becomes occupied once a guest is checked into it,
                  so this opens the check-in form with the room pre-selected
                  rather than flipping a status flag on its own. */}
              <Button
                size="sm"
                className="w-full gap-1.5"
                render={<Link href={`/checkin?room=${room.id}`} />}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Mark Room Occupied
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full gap-1.5 text-muted-foreground hover:text-orange-700 dark:hover:text-orange-400"
                onClick={handleToggleMaintenance}
                disabled={togglingMaintenance}
              >
                {togglingMaintenance ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
                Mark as Maintenance
              </Button>
            </div>
          )
        )}

      </CardContent>
    </Card>
  );
}
