import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { broadcastUpdate } from "@/lib/notifications";

const schema = z.object({
  method: z.enum(["CASH", "CARD", "UPI", "BANK_TRANSFER", "OTHER"]).default("CASH"),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { method } = schema.parse(body);

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.paymentStatus === "PAID") {
    return NextResponse.json({ error: "This booking is already fully paid" }, { status: 409 });
  }

  const outstanding = Number(booking.totalAmount) - Number(booking.amountPaid);

  // Nothing left to collect (e.g. an over-payment was already recorded): mark
  // it paid but don't write a zero/negative payment row, which would corrupt
  // the revenue and profit totals.
  if (outstanding <= 0) {
    const settled = await prisma.booking.update({
      where: { id },
      data: { paymentStatus: "PAID" },
    });
    broadcastUpdate("rooms-updated");
    broadcastUpdate("bookings-updated");
    broadcastUpdate("dashboard-updated");
    broadcastUpdate("guests-updated");
    return NextResponse.json({
      booking: {
        id: settled.id,
        amountPaid: Number(settled.amountPaid),
        totalAmount: Number(settled.totalAmount),
        paymentStatus: settled.paymentStatus,
      },
    });
  }

  const [updated] = await prisma.$transaction([
    prisma.booking.update({
      where: { id },
      data: { amountPaid: booking.totalAmount, paymentStatus: "PAID" },
    }),
    prisma.payment.create({
      data: {
        bookingId: id,
        amount: outstanding,
        method,
        status: "PAID",
        recordedById: session.userId,
      },
    }),
  ]);

  broadcastUpdate("rooms-updated");
  broadcastUpdate("bookings-updated");
  broadcastUpdate("dashboard-updated");
  broadcastUpdate("guests-updated");

  return NextResponse.json({
    booking: {
      id: updated.id,
      amountPaid: Number(updated.amountPaid),
      totalAmount: Number(updated.totalAmount),
      paymentStatus: updated.paymentStatus,
    },
  });
}
