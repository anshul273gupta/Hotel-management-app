"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Eye, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { WhatsAppButton } from "@/components/whatsapp/whatsapp-button";
import { EditBookingDialog } from "@/components/bookings/edit-booking-dialog";
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { HOTEL_NAME, whatsappTemplates } from "@/lib/whatsapp";
import type { GuestRegisterEntry } from "@/lib/guests";

type StayBooking = GuestRegisterEntry["bookings"][number];

/**
 * The WhatsApp message that suits a stay at its current stage.
 *
 * Auto check-out happens without anyone opening a dialog, so the thank-you
 * message that the manual check-out flow offers is never shown for those
 * stays. Surfacing it here means any past guest can still be messaged —
 * whether they were checked out automatically overnight or the dialog was
 * closed too quickly.
 */
function stayMessage(guestName: string, booking: StayBooking) {
  switch (booking.status) {
    case "CHECKED_OUT":
      return {
        label: "Send Thank-you",
        message: whatsappTemplates.checkOutGreeting({
          guestName,
          checkOutTime: formatDateTime(booking.actualCheckOut ?? booking.expectedCheckOut),
        }),
      };
    case "CHECKED_IN":
      return {
        label: "Send Check-in Greeting",
        message: whatsappTemplates.checkInGreeting({
          title: "",
          guestName,
          checkInTime: formatDateTime(booking.checkInDate),
          roomNumber: booking.roomNumber,
        }),
      };
    case "RESERVED":
      return {
        label: "Send Booking Confirmation",
        message: whatsappTemplates.bookingConfirmation({
          guestName,
          roomNumber: booking.roomNumber,
          checkInDate: formatDate(booking.checkInDate),
          expectedCheckOut: formatDate(booking.expectedCheckOut),
          numberOfGuests: booking.numberOfGuests,
        }),
      };
    default:
      return null;
  }
}

export function GuestHistorySheet({
  guest,
  open,
  onOpenChange,
}: {
  guest: GuestRegisterEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [payingId, setPayingId] = useState<string | null>(null);

  async function markAsPaid(bookingId: string) {
    setPayingId(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/payment`, { method: "PATCH" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(typeof data.error === "string" ? data.error : "Could not update payment");
        return;
      }
      toast.success("Marked as fully paid");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPayingId(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-full sm:max-w-sm">
        {guest && (
          <>
            <SheetHeader>
              <SheetTitle>{guest.name}</SheetTitle>
              <SheetDescription>{guest.mobile ?? "No mobile number on record"}</SheetDescription>
            </SheetHeader>

            <div className="space-y-4 overflow-y-auto px-4 pb-4">
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <Stat label="Total Visits" value={guest.totalVisits.toString()} />
                <Stat label="Total Spending" value={formatCurrency(guest.totalSpending)} />
                <Stat label="Favorite Room" value={guest.favoriteRoom ?? "—"} />
                <Stat label="ID Proof" value={guest.idProofType ?? "—"} />
                <Stat label="ID Proof Number" value={guest.idProofNumber ?? "—"} />
              </div>

              {guest.address && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Address</p>
                  <p className="text-sm">{guest.address}</p>
                </div>
              )}

              {guest.specialRequests && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Special Requests</p>
                  <p className="text-sm">{guest.specialRequests}</p>
                </div>
              )}

              {guest.hasIdProofImage && (
                <div className="space-y-2 rounded-lg border p-2.5">
                  <p className="text-xs font-medium text-muted-foreground">ID Proof Photo</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/guests/${guest.id}/id-proof`}
                    alt={`ID proof for ${guest.name}`}
                    className="w-full rounded-md border object-contain"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5"
                      render={
                        <a
                          href={`/api/guests/${guest.id}/id-proof`}
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      }
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View full size
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5"
                      render={<a href={`/api/guests/${guest.id}/id-proof?download=1`} download />}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                  </div>
                </div>
              )}

              {guest.idProofUrl && !guest.hasIdProofImage && (
                <a
                  href={guest.idProofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline"
                >
                  View uploaded ID proof
                </a>
              )}

              <WhatsAppButton
                mobile={guest.mobile}
                label="Message on WhatsApp"
                message={whatsappTemplates.custom(`Hello ${guest.name}, this is ${HOTEL_NAME} reaching out.`)}
                className="w-full"
              />

              <Separator />

              <div className="space-y-2">
                <p className="text-sm font-medium">Stay History</p>
                {guest.bookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No stays recorded yet.</p>
                ) : (
                  guest.bookings.map((booking) => {
                    // Cancelled stays are kept for the record but shouldn't
                    // read as live bookings, so they're dimmed and struck out.
                    const isCancelled = booking.status === "CANCELLED";
                    return (
                    <div
                      key={booking.id}
                      className={
                        isCancelled
                          ? "rounded-lg border border-dashed bg-muted/30 p-2.5 text-sm opacity-70"
                          : "rounded-lg border p-2.5 text-sm"
                      }
                    >
                      <div className="flex items-center justify-between">
                        <p className={isCancelled ? "font-medium line-through" : "font-medium"}>
                          Room {booking.roomNumber}
                        </p>
                        {isCancelled ? (
                          <Badge className="border-0 bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                            Cancelled
                          </Badge>
                        ) : (
                          <Badge className={`${PAYMENT_STATUS_COLORS[booking.paymentStatus]} border-0`}>
                            {PAYMENT_STATUS_LABELS[booking.paymentStatus]}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(booking.checkInDate)} →{" "}
                        {formatDate(booking.actualCheckOut ?? booking.expectedCheckOut)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {BOOKING_STATUS_LABELS[booking.status]} ·{" "}
                        {formatCurrency(booking.amountPaid)} / {formatCurrency(booking.totalAmount)}
                      </p>
                      {booking.paymentStatus !== "PAID" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 w-full gap-1.5"
                          disabled={payingId === booking.id}
                          onClick={() => markAsPaid(booking.id)}
                        >
                          {payingId === booking.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          Mark as Fully Paid
                        </Button>
                      )}
                      {/* Every stay is editable from here — the room grid only
                          ever shows one booking, so a future or completed one
                          had no route to it. */}
                      {booking.status !== "CANCELLED" && (
                        <EditBookingDialog
                          booking={{
                            id: booking.id,
                            status: booking.status,
                            numberOfGuests: booking.numberOfGuests,
                            roomRate: booking.roomRate,
                            totalAmount: booking.totalAmount,
                            amountPaid: booking.amountPaid,
                            checkInDate: booking.checkInDate,
                            expectedCheckOut: booking.expectedCheckOut,
                            notes: booking.notes,
                            roomNumber: booking.roomNumber,
                            guest: {
                              name: guest.name,
                              mobile: guest.mobile,
                              address: guest.address,
                            },
                          }}
                        />
                      )}
                      {(() => {
                        const stay = stayMessage(guest.name, booking);
                        if (!stay) return null;
                        return (
                          <WhatsAppButton
                            mobile={guest.mobile}
                            label={stay.label}
                            message={stay.message}
                            className="mt-2 w-full"
                          />
                        );
                      })()}
                    </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      {/* Long values like a spend total or ID number would otherwise overflow
          the narrow column on a phone. */}
      <p className="font-display text-base font-semibold break-words sm:text-lg">{value}</p>
    </div>
  );
}
