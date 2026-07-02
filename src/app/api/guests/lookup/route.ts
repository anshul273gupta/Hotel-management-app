import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { toDecimalNumber } from "@/lib/format";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mobile = new URL(request.url).searchParams.get("mobile")?.trim();
  if (!mobile) {
    return NextResponse.json({ error: "Mobile number is required" }, { status: 400 });
  }

  const guest = await prisma.guest.findUnique({
    where: { mobile },
    include: {
      bookings: {
        include: { room: true },
        orderBy: { checkInDate: "desc" },
      },
    },
  });

  if (!guest) {
    return NextResponse.json({ guest: null });
  }

  const roomCounts = new Map<string, number>();
  let totalSpending = 0;
  for (const booking of guest.bookings) {
    roomCounts.set(booking.room.number, (roomCounts.get(booking.room.number) ?? 0) + 1);
    totalSpending += toDecimalNumber(booking.amountPaid);
  }
  const favoriteRoom = [...roomCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return NextResponse.json({
    guest: {
      id: guest.id,
      name: guest.name,
      mobile: guest.mobile,
      address: guest.address,
      idProofType: guest.idProofType,
      idProofNumber: guest.idProofNumber,
      idProofUrl: guest.idProofUrl,
      specialRequests: guest.specialRequests,
      totalVisits: guest.bookings.length,
      totalSpending,
      favoriteRoom,
      lastStay: guest.bookings[0]
        ? {
            roomNumber: guest.bookings[0].room.number,
            checkInDate: guest.bookings[0].checkInDate,
            expectedCheckOut: guest.bookings[0].expectedCheckOut,
          }
        : null,
    },
  });
}
