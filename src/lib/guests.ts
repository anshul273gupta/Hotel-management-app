import { prisma } from "@/lib/prisma";
import { toDecimalNumber } from "@/lib/format";

export async function getGuestsRegister() {
  const guests = await prisma.guest.findMany({
    // Pulling idProofImage into the register would ship every stored photo on
    // each page load, so the bytes are fetched only by the download route.
    omit: { idProofImage: true },
    include: {
      // Count only — the bytes must never ship with the register.
      _count: { select: { idProofs: true } },
      bookings: {
        include: { room: true },
        orderBy: { checkInDate: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return guests.map((guest) => {
    const roomCounts = new Map<string, number>();
    let totalSpending = 0;
    for (const booking of guest.bookings) {
      roomCounts.set(booking.room.number, (roomCounts.get(booking.room.number) ?? 0) + 1);
      totalSpending += toDecimalNumber(booking.amountPaid);
    }
    const favoriteRoom = [...roomCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const lastBooking = guest.bookings[0] ?? null;

    const currentStatus =
      guest.bookings.find((b) => b.status === "CHECKED_IN")?.status ??
      guest.bookings.find((b) => b.status === "RESERVED")?.status ??
      lastBooking?.status ??
      null;

    const hasPendingPayment = guest.bookings.some(
      (b) => b.paymentStatus !== "PAID" && b.status !== "CANCELLED" && b.status !== "CHECKED_OUT",
    );

    return {
      id: guest.id,
      name: guest.name,
      mobile: guest.mobile,
      address: guest.address,
      idProofType: guest.idProofType,
      idProofNumber: guest.idProofNumber,
      idProofUrl: guest.idProofUrl,
      // Only whether a photo exists — the bytes stay out of the list query.
      // Legacy single photo still counts when no newer ones exist.
      idProofCount: guest._count.idProofs > 0 ? guest._count.idProofs : (guest.idProofMimeType ? 1 : 0),
      specialRequests: guest.specialRequests,
      totalVisits: guest.bookings.length,
      totalSpending,
      favoriteRoom,
      currentStatus,
      hasPendingPayment,
      lastCheckIn: lastBooking?.checkInDate ?? null,
      lastCheckOut: lastBooking?.expectedCheckOut ?? null,
      bookings: guest.bookings.map((booking) => ({
        id: booking.id,
        roomNumber: booking.room.number,
        numberOfGuests: booking.numberOfGuests,
        roomRate: toDecimalNumber(booking.roomRate),
        notes: booking.notes,
        checkInDate: booking.checkInDate,
        expectedCheckOut: booking.expectedCheckOut,
        actualCheckOut: booking.actualCheckOut,
        totalAmount: toDecimalNumber(booking.totalAmount),
        amountPaid: toDecimalNumber(booking.amountPaid),
        paymentStatus: booking.paymentStatus,
        status: booking.status,
      })),
    };
  });
}

export type GuestRegisterEntry = Awaited<ReturnType<typeof getGuestsRegister>>[number];
