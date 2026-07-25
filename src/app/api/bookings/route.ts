import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, destroySession } from "@/lib/session";
import { createNotification, broadcastUpdate } from "@/lib/notifications";
import { syncRoomStatus } from "@/lib/rooms";
import { toDecimalNumber } from "@/lib/format";
import { ID_PROOF_PATTERNS, normalizeIdProofNumber } from "@/lib/constants";

const schema = z
  .object({
    guestName: z.string().min(1, "Guest name is required"),
    title: z.enum(["Mr.", "Mrs.", "Ms.", "Dr.", "Master"]).default("Mr."),
    mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid Indian mobile number"),
    address: z.string().min(1, "Address is required"),
    idProofType: z.string().optional().default(""),
    idProofNumber: z.string().optional().default(""),
    numberOfGuests: z.coerce.number().int().min(1).max(20),
    roomId: z.string().min(1, "Select a room"),
    checkInTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time").optional(),
    expectedCheckOut: z.string().min(1, "Select an expected check-out date"),
    roomRate: z.coerce.number().positive("Enter the room rent"),
    advanceAmount: z.coerce.number().min(0).default(0),
    paymentMethod: z.enum(["CASH", "CARD", "UPI", "BANK_TRANSFER", "OTHER"]).default("CASH"),
    specialRequests: z.string().optional(),
  })
  .superRefine((data, ctx) => {
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

  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const data = parsed.data;

  let checkInDate = new Date();
  if (data.checkInTime) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    checkInDate = new Date(`${year}-${month}-${day}T${data.checkInTime}`);
  }
  const expectedCheckOut = new Date(data.expectedCheckOut);
  if (expectedCheckOut <= checkInDate) {
    return NextResponse.json(
      { error: { expectedCheckOut: ["Check-out must be after check-in"] } },
      { status: 400 },
    );
  }
  const nights = Math.max(
    1,
    Math.ceil((expectedCheckOut.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const roomRate = data.roomRate;
  const totalAmount = roomRate * nights;
  const amountPaid = data.advanceAmount;
  const paymentStatus = amountPaid <= 0 ? "PENDING" : amountPaid >= totalAmount ? "PAID" : "PARTIAL";

  // Upsert guest first (safe to do outside transaction)
  const guest = await prisma.guest.upsert({
    where: { mobile: data.mobile },
    create: {
      title: data.title,
      name: data.guestName,
      mobile: data.mobile,
      address: data.address || undefined,
      idProofType: data.idProofType || undefined,
      idProofNumber: data.idProofNumber || undefined,
      specialRequests: data.specialRequests || undefined,
    },
    update: {
      title: data.title,
      name: data.guestName,
      ...(data.idProofType ? { idProofType: data.idProofType } : {}),
      ...(data.idProofNumber ? { idProofNumber: data.idProofNumber } : {}),
      ...(data.address ? { address: data.address } : {}),
      ...(data.specialRequests ? { specialRequests: data.specialRequests } : {}),
    },
  });

  // Atomic: re-check availability, create booking, and update room status together
  let booking: Awaited<ReturnType<typeof prisma.booking.create>> & { guest: typeof guest; room: { number: string; type: string; floor: number; maintenanceStatus: string } };
  try {
    const result = await prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({ where: { id: data.roomId } });
      if (!room) throw Object.assign(new Error("Room not found"), { status: 404 });
      if (room.maintenanceStatus === "UNDER_MAINTENANCE") {
        throw Object.assign(new Error("Room is under maintenance"), { status: 409 });
      }

      // Check the actual stay dates rather than the room's current status flag:
      // a reservation starting next month must not block tonight's walk-in.
      const overlapping = await tx.booking.findFirst({
        where: {
          roomId: room.id,
          status: { in: ["CHECKED_IN", "RESERVED"] },
          checkInDate: { lt: expectedCheckOut },
          expectedCheckOut: { gt: checkInDate },
        },
      });
      if (overlapping) {
        throw Object.assign(new Error("Room is already booked for these dates"), { status: 409 });
      }

      const newBooking = await tx.booking.create({
        data: {
          guestId: guest.id,
          roomId: room.id,
          numberOfGuests: data.numberOfGuests,
          checkInDate,
          expectedCheckOut,
          status: "CHECKED_IN",
          roomRate,
          totalAmount,
          amountPaid,
          paymentStatus,
          notes: data.specialRequests || undefined,
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
    return NextResponse.json({ error: { roomId: [e?.message ?? "Failed to create booking"] } }, { status });
  }

  const room = booking.room;

  await createNotification({
    type: "CHECK_IN",
    title: `${guest.name} checked into Room ${room.number}`,
    message: `${data.numberOfGuests} guest${data.numberOfGuests === 1 ? "" : "s"} · checkout ${expectedCheckOut.toLocaleDateString("en-IN")}`,
    link: "/rooms",
  });

  broadcastUpdate("rooms-updated");
  broadcastUpdate("bookings-updated");
  broadcastUpdate("dashboard-updated");
  broadcastUpdate("guests-updated");

  return NextResponse.json({
    booking: {
      id: booking.id,
      checkInDate: booking.checkInDate,
      expectedCheckOut: booking.expectedCheckOut,
      totalAmount: toDecimalNumber(booking.totalAmount),
      amountPaid: toDecimalNumber(booking.amountPaid),
      paymentStatus: booking.paymentStatus,
    },
    guest: { title: guest.title ?? "Mr.", name: guest.name, mobile: guest.mobile },
    room: { number: room.number, type: room.type, floor: room.floor },
  });
}
