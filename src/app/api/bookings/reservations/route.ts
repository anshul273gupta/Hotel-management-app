import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, destroySession } from "@/lib/session";
import { createNotification, broadcastUpdate } from "@/lib/notifications";
import { syncRoomStatus } from "@/lib/rooms";
import { toDecimalNumber } from "@/lib/format";
import { ID_PROOF_PATTERNS, OWNER_SETTLE_NOTE, normalizeIdProofNumber } from "@/lib/constants";
import { findOrCreateGuest } from "@/lib/guest-matching";
import { parseHotelDateTime, nightsBetween } from "@/lib/service-hours";

const schema = z
  .object({
    guestName: z.string().min(1, "Guest name is required"),
    title: z.enum(["Mr.", "Mrs.", "Ms.", "Dr.", "Master"]).default("Mr."),
    // Optional: some walk-in guests decline to give a number. Blank is
    // accepted, but anything entered must still be a valid Indian mobile.
    mobile: z
      .string()
      .optional()
      .default("")
      .refine((v) => v === "" || /^[6-9]\d{9}$/.test(v), "Enter a valid Indian mobile number"),
    // Optional — walk-in guests are not always willing to give an address.
    address: z.string().optional().default(""),
    idProofType: z.string().optional().default(""),
    idProofNumber: z.string().optional().default(""),
    numberOfGuests: z.coerce.number().int().min(1).max(20),
    roomId: z.string().min(1, "Select a room"),
    checkInDate: z.string().min(1, "Select a check-in date"),
    expectedCheckOut: z.string().min(1, "Select a check-out date"),
    // May be 0 only when the owner is settling the payment separately.
    roomRate: z.coerce.number().min(0, "Enter the room rent"),
    advanceAmount: z.coerce.number().min(0).default(0),
    /**
     * Sent by the "Payment will be done by owner" tick on the booking form.
     * Matched against the literal string because JSON may send either a real
     * boolean or text, and coercion would read "false" as true.
     */
    ownerWillSettle: z
      .union([z.boolean(), z.string()])
      .optional()
      .transform((v) => v === true || v === "true"),
    paymentMethod: z.enum(["CASH", "CARD", "UPI", "BANK_TRANSFER", "OTHER"]).default("CASH"),
    specialRequests: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Re-check on the server: the rent is only allowed to be missing when the
    // owner is settling up, so the browser check cannot be bypassed to create
    // a free booking.
    if (!data.ownerWillSettle && !(data.roomRate > 0)) {
      ctx.addIssue({ code: "custom", path: ["roomRate"], message: "Enter the room rent" });
    }
    if (data.idProofType && data.idProofNumber) {
      const pattern = ID_PROOF_PATTERNS[data.idProofType as keyof typeof ID_PROOF_PATTERNS];
      if (pattern && !pattern.regex.test(normalizeIdProofNumber(data.idProofNumber))) {
        ctx.addIssue({ code: "custom", path: ["idProofNumber"], message: pattern.message });
      }
    }
  });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionUser = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true } });
  if (!sessionUser) {
    await destroySession();
    return NextResponse.json(
      { error: "Your session has expired. Please log in again." },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const data = parsed.data;

  const checkInDate = parseHotelDateTime(data.checkInDate);
  const expectedCheckOut = parseHotelDateTime(data.expectedCheckOut);
  if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(expectedCheckOut.getTime())) {
    return NextResponse.json({ error: { checkInDate: ["Invalid date"] } }, { status: 400 });
  }
  if (expectedCheckOut <= checkInDate) {
    return NextResponse.json(
      { error: { expectedCheckOut: ["Check-out must be after check-in"] } },
      { status: 400 },
    );
  }

  const nights = nightsBetween(checkInDate, expectedCheckOut);
  const roomRate = data.ownerWillSettle ? 0 : data.roomRate;
  const totalAmount = roomRate * nights;
  const amountPaid = data.ownerWillSettle ? 0 : data.advanceAmount;
  // A booking the owner will settle has no amount yet, so it must read as
  // PENDING rather than PAID — otherwise a zero total would look settled.
  const paymentStatus = data.ownerWillSettle
    ? "PENDING"
    : amountPaid <= 0
      ? "PENDING"
      : amountPaid >= totalAmount
        ? "PAID"
        : "PARTIAL";

  // Reuse the guest record when this is someone who has stayed before.
  const guest = await findOrCreateGuest({
    title: data.title,
    guestName: data.guestName,
    mobile: data.mobile,
    address: data.address,
    idProofType: data.idProofType,
    idProofNumber: data.idProofNumber,
    specialRequests: data.specialRequests,
  });

  // Atomic: overlap check, booking create, room status update
  let booking: Awaited<ReturnType<typeof prisma.booking.create>> & { guest: typeof guest; room: { number: string; floor: number } };
  try {
    const result = await prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({ where: { id: data.roomId } });
      if (!room) throw Object.assign(new Error("Room not found"), { status: 404 });
      if (room.maintenanceStatus === "UNDER_MAINTENANCE") throw Object.assign(new Error("Room is under maintenance"), { status: 409 });

      const overlapping = await tx.booking.findFirst({
        where: {
          roomId: room.id,
          status: { in: ["CHECKED_IN", "RESERVED"] },
          checkInDate: { lt: expectedCheckOut },
          expectedCheckOut: { gt: checkInDate },
        },
      });
      if (overlapping) throw Object.assign(new Error("Room is already booked for these dates"), { status: 409 });

      const newBooking = await tx.booking.create({
        data: {
          guestId: guest.id,
          roomId: room.id,
          numberOfGuests: data.numberOfGuests,
          checkInDate,
          expectedCheckOut,
          status: "RESERVED",
          roomRate,
          totalAmount,
          amountPaid,
          paymentStatus,
          notes: data.ownerWillSettle
            ? [OWNER_SETTLE_NOTE, data.specialRequests].filter(Boolean).join(" — ")
            : data.specialRequests || undefined,
          createdById: session.userId,
          ...(amountPaid > 0
            ? {
                payments: {
                  create: {
                    amount: amountPaid,
                    method: data.paymentMethod,
                    status: "PAID",
                    recordedById: session.userId,
                  },
                },
              }
            : {}),
        },
        include: { guest: true, room: true },
      });

      await syncRoomStatus(room.id, tx);

      return newBooking;
    });
    booking = result as typeof booking;
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    const status = e?.status ?? 500;
    return NextResponse.json({ error: { roomId: [e?.message ?? "Failed to create reservation"] } }, { status });
  }

  const room = booking.room;

  await createNotification({
    type: "RESERVATION",
    title: `New booking for ${guest.name}`,
    message: `Room ${room.number} reserved for ${checkInDate.toLocaleDateString("en-IN")} → ${expectedCheckOut.toLocaleDateString("en-IN")}`,
    link: "/guests",
  });

  broadcastUpdate("rooms-updated");
  broadcastUpdate("bookings-updated");
  broadcastUpdate("guests-updated");
  broadcastUpdate("dashboard-updated");

  return NextResponse.json({
    booking: {
      id: booking.id,
      checkInDate: booking.checkInDate,
      expectedCheckOut: booking.expectedCheckOut,
      totalAmount: toDecimalNumber(booking.totalAmount),
      amountPaid: toDecimalNumber(booking.amountPaid),
      paymentStatus: booking.paymentStatus,
    },
    guest: { name: guest.name, mobile: guest.mobile },
    room: { number: room.number, floor: room.floor },
  });
}
