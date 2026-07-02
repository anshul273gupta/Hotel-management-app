import { prisma } from "@/lib/prisma";
import { toDecimalNumber } from "@/lib/format";

export async function getUpcomingBookings() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ["RESERVED", "CHECKED_IN"] },
      expectedCheckOut: { gte: today },
    },
    include: { guest: true, room: true },
    orderBy: { checkInDate: "asc" },
  });

  return bookings.map((booking) => ({
    id: booking.id,
    checkInDate: booking.checkInDate,
    expectedCheckOut: booking.expectedCheckOut,
    status: booking.status,
    numberOfGuests: booking.numberOfGuests,
    paymentStatus: booking.paymentStatus,
    totalAmount: toDecimalNumber(booking.totalAmount),
    amountPaid: toDecimalNumber(booking.amountPaid),
    guest: { name: booking.guest.name, mobile: booking.guest.mobile },
    room: { number: booking.room.number, floor: booking.room.floor },
  }));
}

export type UpcomingBooking = Awaited<ReturnType<typeof getUpcomingBookings>>[number];
