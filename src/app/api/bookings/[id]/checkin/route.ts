import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { createNotification, broadcastUpdate } from "@/lib/notifications";
import { syncRoomStatus } from "@/lib/rooms";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { guest: true, room: true },
  });

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.status !== "RESERVED") {
    return NextResponse.json({ error: "Booking is not in reserved status" }, { status: 409 });
  }

  const conflict = await prisma.booking.findFirst({
    where: { roomId: booking.roomId, status: "CHECKED_IN", id: { not: id } },
  });
  if (conflict) {
    return NextResponse.json({ error: "Room already has an active booking" }, { status: 409 });
  }

  await prisma.booking.update({
    where: { id },
    data: { status: "CHECKED_IN", checkInDate: new Date() },
  });

  await syncRoomStatus(booking.roomId);

  await createNotification({
    type: "CHECK_IN",
    title: `${booking.guest.name} checked into Room ${booking.room.number}`,
    message: `Arrival confirmed — ${booking.numberOfGuests} guest${booking.numberOfGuests === 1 ? "" : "s"}`,
    link: "/rooms",
  });

  broadcastUpdate("rooms-updated");
  broadcastUpdate("bookings-updated");
  broadcastUpdate("dashboard-updated");
  broadcastUpdate("guests-updated");

  return NextResponse.json({
    ok: true,
    guest: { title: booking.guest.title ?? "Mr.", name: booking.guest.name, mobile: booking.guest.mobile },
    room: { number: booking.room.number, floor: booking.room.floor },
    checkInDate: new Date().toISOString(),
  });
}
