import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { broadcastUpdate } from "@/lib/notifications";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (!body?.newTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.newTime)) {
    return NextResponse.json({ error: "Invalid time format (expected HH:MM)" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.status !== "RESERVED") {
    return NextResponse.json({ error: "Booking is not in reserved status" }, { status: 409 });
  }

  const [hours, minutes] = (body.newTime as string).split(":").map(Number);
  const newCheckInDate = new Date();
  newCheckInDate.setHours(hours, minutes, 0, 0);

  // If the time has already passed today, push to tomorrow
  if (newCheckInDate <= new Date()) {
    newCheckInDate.setDate(newCheckInDate.getDate() + 1);
  }

  if (newCheckInDate >= booking.expectedCheckOut) {
    return NextResponse.json(
      { error: "New check-in time must be before the expected check-out" },
      { status: 400 },
    );
  }

  await prisma.booking.update({
    where: { id },
    data: { checkInDate: newCheckInDate },
  });

  broadcastUpdate("bookings-updated");

  return NextResponse.json({ ok: true, newCheckInDate });
}
