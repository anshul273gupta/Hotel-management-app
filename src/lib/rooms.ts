import { prisma } from "@/lib/prisma";
import { toDecimalNumber } from "@/lib/format";
import type { CleaningStatus, MaintenanceStatus, RoomStatus } from "@/lib/types";

export async function getRoomsWithCurrentBooking() {
  const rooms = await prisma.room.findMany({
    orderBy: [{ floor: "asc" }, { number: "asc" }],
    include: {
      bookings: {
        where: { status: { in: ["CHECKED_IN", "RESERVED"] } },
        include: { guest: true },
        orderBy: { checkInDate: "asc" },
      },
    },
  });

  return rooms.map((room) => {
    const { bookings, ...rest } = room;
    const checkedIn = bookings.find((b) => b.status === "CHECKED_IN") ?? null;
    const reserved = bookings.find((b) => b.status === "RESERVED") ?? null;

    function mapBooking(b: (typeof bookings)[number] | null) {
      if (!b) return null;
      return {
        ...b,
        roomRate: toDecimalNumber(b.roomRate),
        totalAmount: toDecimalNumber(b.totalAmount),
        amountPaid: toDecimalNumber(b.amountPaid),
      };
    }

    return {
      ...rest,
      basePrice: toDecimalNumber(rest.basePrice),
      currentBooking: mapBooking(checkedIn),
      reservedBooking: mapBooking(reserved),
    };
  });
}

export type RoomWithCurrentBooking = Awaited<ReturnType<typeof getRoomsWithCurrentBooking>>[number];

export async function getAvailableRooms() {
  const rooms = await prisma.room.findMany({
    where: { status: "AVAILABLE" },
    orderBy: [{ floor: "asc" }, { number: "asc" }],
  });

  return rooms.map((room) => ({
    ...room,
    basePrice: toDecimalNumber(room.basePrice),
  }));
}

export type AvailableRoom = Awaited<ReturnType<typeof getAvailableRooms>>[number];

/**
 * Rooms with no CHECKED_IN or RESERVED booking overlapping the given date
 * range, and not currently under maintenance. Used to populate room choices
 * for advance bookings, where the room's current-moment status doesn't matter.
 */
export async function getAvailableRoomsForRange(checkIn: Date, checkOut: Date) {
  const rooms = await prisma.room.findMany({
    where: {
      maintenanceStatus: { not: "UNDER_MAINTENANCE" },
      bookings: {
        none: {
          status: { in: ["CHECKED_IN", "RESERVED"] },
          checkInDate: { lt: checkOut },
          expectedCheckOut: { gt: checkIn },
        },
      },
    },
    orderBy: [{ floor: "asc" }, { number: "asc" }],
  });

  return rooms.map((room) => ({
    ...room,
    basePrice: toDecimalNumber(room.basePrice),
  }));
}

export type AvailableRoomForRange = Awaited<ReturnType<typeof getAvailableRoomsForRange>>[number];

export function deriveRoomStatus({
  maintenanceStatus,
  hasActiveBooking,
  hasReservedBooking = false,
}: {
  cleaningStatus?: string;
  maintenanceStatus: string;
  hasActiveBooking: boolean;
  hasReservedBooking?: boolean;
}): RoomStatus {
  if (maintenanceStatus === "UNDER_MAINTENANCE") return "MAINTENANCE";
  if (hasActiveBooking) return "OCCUPIED";
  if (hasReservedBooking) return "RESERVED";
  return "AVAILABLE";
}
