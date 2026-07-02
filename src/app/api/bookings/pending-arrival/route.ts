import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();

  const bookings = await prisma.booking.findMany({
    where: {
      status: "RESERVED",
      checkInDate: { lte: now },
    },
    include: { guest: true, room: true },
    orderBy: { checkInDate: "asc" },
  });

  return NextResponse.json({
    bookings: bookings.map((b) => ({
      id: b.id,
      guestTitle: b.guest.title ?? "Mr.",
      guestName: b.guest.name,
      guestMobile: b.guest.mobile,
      roomNumber: b.room.number,
      floor: b.room.floor,
      checkInDate: b.checkInDate,
      numberOfGuests: b.numberOfGuests,
    })),
  });
}
