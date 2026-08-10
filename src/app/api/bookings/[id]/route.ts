import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { createNotification, broadcastUpdate } from "@/lib/notifications";
import { syncRoomStatus } from "@/lib/rooms";
import { toDecimalNumber, formatCurrency } from "@/lib/format";
import { parseHotelDateTime, nightsBetween } from "@/lib/service-hours";

const schema = z.object({
  guestName: z.string().min(1, "Guest name is required").optional(),
  mobile: z
    .string()
    .optional()
    .refine((v) => !v || /^[6-9]\d{9}$/.test(v), "Enter a valid Indian mobile number"),
  address: z.string().optional(),
  numberOfGuests: z.coerce.number().int().min(1).max(20).optional(),
  roomRate: z.coerce.number().min(0, "Enter the room rent").optional(),
  /** Move the stay to a different room, before or after the guest arrives. */
  roomId: z.string().min(1).optional(),
  /**
   * Further money collected since the booking was made, e.g. the balance paid
   * at check-out. Added to what has already been received rather than
   * replacing it, so the payment history stays intact.
   */
  additionalPayment: z.coerce.number().min(0).optional(),
  paymentMethod: z.enum(["CASH", "CARD", "UPI", "BANK_TRANSFER", "OTHER"]).default("CASH"),
  checkInDate: z.string().optional(),
  expectedCheckOut: z.string().optional(),
  notes: z.string().optional(),
});

// Nights come from nightsBetween() in service-hours, which counts calendar
// nights in the hotel's timezone. Rounding up elapsed hours (the old approach
// here) billed a 24h40m stay as two nights, so an edit could quietly change
// the total even when nothing about the dates had been touched.

function derivePaymentStatus(paid: number, total: number) {
  if (paid <= 0) return "PENDING";
  return paid >= total ? "PAID" : "PARTIAL";
}

/**
 * Edits an existing booking.
 *
 * Rates get mistyped and stays get extended, but until now a booking was
 * immutable once created — the only way to correct one was editing the
 * database by hand.
 *
 * Changing dates re-checks for overlaps so a stay can't be extended over
 * another booking, and the total is always recomputed from rate x nights so
 * it can't drift away from what's actually owed.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const data = parsed.data;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { guest: true, room: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.status === "CANCELLED") {
    return NextResponse.json({ error: "This booking has been cancelled" }, { status: 409 });
  }

  const checkInDate = data.checkInDate ? parseHotelDateTime(data.checkInDate) : booking.checkInDate;
  const expectedCheckOut = data.expectedCheckOut
    ? parseHotelDateTime(data.expectedCheckOut)
    : booking.expectedCheckOut;

  if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(expectedCheckOut.getTime())) {
    return NextResponse.json({ error: { checkInDate: ["Invalid date"] } }, { status: 400 });
  }
  if (expectedCheckOut <= checkInDate) {
    return NextResponse.json(
      { error: { expectedCheckOut: ["Check-out must be after check-in"] } },
      { status: 400 },
    );
  }

  // A guest already in the room can have their departure moved, but rewriting
  // when they arrived would contradict the record.
  if (data.checkInDate && booking.status !== "RESERVED") {
    const changed = new Date(data.checkInDate).getTime() !== booking.checkInDate.getTime();
    if (changed) {
      return NextResponse.json(
        { error: { checkInDate: ["Check-in date can only be changed while the booking is still reserved"] } },
        { status: 409 },
      );
    }
  }

  // Moving rooms: guests get shifted for maintenance, noise or an upgrade,
  // and the room is also simply picked wrongly at check-in sometimes.
  const targetRoomId = data.roomId ?? booking.roomId;
  const roomChanged = targetRoomId !== booking.roomId;

  let targetRoom = booking.room;
  if (roomChanged) {
    const found = await prisma.room.findUnique({ where: { id: targetRoomId } });
    if (!found) {
      return NextResponse.json({ error: { roomId: ["Room not found"] } }, { status: 404 });
    }
    if (found.maintenanceStatus === "UNDER_MAINTENANCE") {
      return NextResponse.json(
        { error: { roomId: [`Room ${found.number} is under maintenance`] } },
        { status: 409 },
      );
    }
    targetRoom = found;
  }

  const datesChanged =
    checkInDate.getTime() !== booking.checkInDate.getTime() ||
    expectedCheckOut.getTime() !== booking.expectedCheckOut.getTime();

  // The clash check must run against the room the stay is moving INTO, and
  // must also run when only the room changes — otherwise two guests could be
  // put in the same room for the same nights.
  if (datesChanged || roomChanged) {
    const clash = await prisma.booking.findFirst({
      where: {
        id: { not: id },
        roomId: targetRoomId,
        status: { in: ["CHECKED_IN", "RESERVED"] },
        checkInDate: { lt: expectedCheckOut },
        expectedCheckOut: { gt: checkInDate },
      },
      include: { guest: true },
    });
    if (clash) {
      return NextResponse.json(
        {
          error: {
            expectedCheckOut: [
              `Room ${targetRoom.number} is already booked for those dates by ${clash.guest.name}`,
            ],
          },
        },
        { status: 409 },
      );
    }
  }

  const roomRate = data.roomRate ?? toDecimalNumber(booking.roomRate);
  const totalAmount = roomRate * nightsBetween(checkInDate, expectedCheckOut);

  const alreadyPaid = toDecimalNumber(booking.amountPaid);
  const extraPayment = data.additionalPayment ?? 0;
  const amountPaid = Math.round((alreadyPaid + extraPayment) * 100) / 100;

  // Refuse to take more than is owed. Left unchecked this books money as
  // revenue the hotel has to hand back, and it is nearly always a typo.
  if (extraPayment > 0 && amountPaid > totalAmount) {
    const outstanding = Math.max(0, totalAmount - alreadyPaid);
    return NextResponse.json(
      {
        error: {
          additionalPayment: [
            `Only ${formatCurrency(outstanding)} is outstanding on this booking.`,
          ],
        },
      },
      { status: 400 },
    );
  }

  const paymentStatus = derivePaymentStatus(amountPaid, totalAmount);

  const updated = await prisma.$transaction(async (tx) => {
    if (data.guestName || data.mobile !== undefined || data.address !== undefined) {
      await tx.guest.update({
        where: { id: booking.guestId },
        data: {
          ...(data.guestName ? { name: data.guestName } : {}),
          ...(data.mobile !== undefined ? { mobile: data.mobile || null } : {}),
          ...(data.address !== undefined ? { address: data.address || null } : {}),
        },
      });
    }

    // Recorded as its own payment row so the money appears in revenue on the
    // day it was actually taken, and the history shows how it was collected.
    if (extraPayment > 0) {
      await tx.payment.create({
        data: {
          bookingId: id,
          amount: extraPayment,
          method: data.paymentMethod,
          status: "PAID",
          recordedById: session.userId,
        },
      });
    }

    const result = await tx.booking.update({
      where: { id },
      data: {
        ...(data.numberOfGuests ? { numberOfGuests: data.numberOfGuests } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
        ...(roomChanged ? { roomId: targetRoomId } : {}),
        checkInDate,
        expectedCheckOut,
        roomRate,
        totalAmount,
        amountPaid,
        paymentStatus,
      },
      include: { guest: true, room: true },
    });

    // Both rooms need refreshing on a move: the one being left may now be
    // free, and the one being taken becomes occupied or reserved.
    await syncRoomStatus(booking.roomId, tx);
    if (roomChanged) await syncRoomStatus(targetRoomId, tx);
    return result;
  });

  broadcastUpdate("rooms-updated");
  broadcastUpdate("bookings-updated");
  broadcastUpdate("dashboard-updated");
  broadcastUpdate("guests-updated");

  return NextResponse.json({
    booking: {
      id: updated.id,
      totalAmount: toDecimalNumber(updated.totalAmount),
      amountPaid: toDecimalNumber(updated.amountPaid),
      paymentStatus: updated.paymentStatus,
      roomRate: toDecimalNumber(updated.roomRate),
      roomNumber: updated.room.number,
      checkInDate: updated.checkInDate,
      expectedCheckOut: updated.expectedCheckOut,
    },
    movedFromRoom: roomChanged ? booking.room.number : null,
    // Surfaced so the UI can warn about money owed back after a rate cut.
    refundDue: Math.max(0, amountPaid - totalAmount),
  });
}

/**
 * Cancels a booking.
 *
 * The row is kept and marked CANCELLED rather than deleted: payments already
 * recorded against it are part of the revenue history, and reports already
 * exclude cancelled bookings.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { guest: true, room: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.status === "CANCELLED") {
    return NextResponse.json({ error: "This booking is already cancelled" }, { status: 409 });
  }
  if (booking.status === "CHECKED_OUT") {
    return NextResponse.json(
      { error: "This stay has already been completed and cannot be cancelled" },
      { status: 409 },
    );
  }

  await prisma.booking.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  await syncRoomStatus(booking.roomId);

  await createNotification({
    type: "RESERVATION",
    title: `Booking cancelled — Room ${booking.room.number}`,
    message: `${booking.guest.name}'s booking was cancelled by ${session.name}`,
    link: "/rooms",
  });

  broadcastUpdate("rooms-updated");
  broadcastUpdate("bookings-updated");
  broadcastUpdate("dashboard-updated");
  broadcastUpdate("guests-updated");

  return NextResponse.json({
    ok: true,
    refundDue: toDecimalNumber(booking.amountPaid),
  });
}
