"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { HOTEL_NAME, whatsappTemplates } from "@/lib/whatsapp";
import type { GuestRegisterEntry } from "@/lib/guests";

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
      <SheetContent>
        {guest && (
          <>
            <SheetHeader>
              <SheetTitle>{guest.name}</SheetTitle>
              <SheetDescription>{guest.mobile ?? "No mobile number on record"}</SheetDescription>
            </SheetHeader>

            <div className="space-y-4 overflow-y-auto px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
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

              {guest.idProofUrl && (
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
                  guest.bookings.map((booking) => (
                    <div key={booking.id} className="rounded-lg border p-2.5 text-sm">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">Room {booking.roomNumber}</p>
                        <Badge className={`${PAYMENT_STATUS_COLORS[booking.paymentStatus]} border-0`}>
                          {PAYMENT_STATUS_LABELS[booking.paymentStatus]}
                        </Badge>
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
                    </div>
                  ))
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
      <p className="font-display text-lg font-semibold">{value}</p>
    </div>
  );
}
