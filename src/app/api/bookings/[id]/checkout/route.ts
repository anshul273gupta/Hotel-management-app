import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { createNotification, broadcastUpdate } from "@/lib/notifications";
import { syncRoomStatus } from "@/lib/rooms";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  if (booking.status !== "CHECKED_IN") {
    return NextResponse.json({ error: "This booking is not currently checked in" }, { status: 409 });
  }
  if (booking.paymentStatus !== "PAID") {
    return NextResponse.json({ error: "Cannot check out: payment is due. Please clear the payment first." }, { status: 402 });
  }

  const actualCheckOut = new Date();

  const updated = await prisma.booking.update({
    where: { id },
    data: { status: "CHECKED_OUT", actualCheckOut },
  });

  await prisma.room.update({
    where: { id: booking.roomId },
    data: { cleaningStatus: "CLEAN" },
  });
  // Recompute from live bookings so a room that still holds an upcoming
  // reservation goes back to RESERVED instead of falsely showing AVAILABLE.
  await syncRoomStatus(booking.roomId);

  await createNotification({
    type: "CHECK_OUT",
    title: `${booking.guest.name} checked out of Room ${booking.room.number}`,
    message: `Checked out at ${actualCheckOut.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`,
    link: "/rooms",
  });

  broadcastUpdate("rooms-updated");
  broadcastUpdate("bookings-updated");
  broadcastUpdate("dashboard-updated");
  broadcastUpdate("guests-updated");

  return NextResponse.json({
    booking: {
      id: updated.id,
      status: updated.status,
      actualCheckOut: updated.actualCheckOut,
    },
  });
}
