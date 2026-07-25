import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toDecimalNumber } from "@/lib/format";
import type { RoomStatus } from "@/lib/types";

/** Accepts either the shared client or a transaction client. */
type Db = Prisma.TransactionClient | typeof prisma;

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

/**
 * Rooms a walk-in guest can be checked into right now.
 *
 * A room is bookable tonight as long as nothing overlaps the stay that is
 * about to start — a reservation for a future date must NOT block it. Using
 * the room's current-moment `status` here wrongly hid rooms that merely had
 * an advance booking weeks away.
 */
export async function getAvailableRooms(until?: Date) {
  const now = new Date();
  const end = until ?? endOfToday(now);
  return getAvailableRoomsForRange(now, end > now ? end : new Date(now.getTime() + 60 * 60 * 1000));
}

export type AvailableRoom = Awaited<ReturnType<typeof getAvailableRooms>>[number];

function endOfToday(from: Date) {
  const d = new Date(from);
  d.setHours(23, 59, 59, 999);
  return d;
}

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

/** How soon a future reservation starts before the room is flagged RESERVED. */
const RESERVED_LOOKAHEAD_MS = 24 * 60 * 60 * 1000;

/**
 * Recomputes and persists a room's status from the bookings that actually
 * exist, instead of trusting the caller to pass the right flags.
 *
 * Every mutation that can change occupancy (check-in, check-out, new booking,
 * new reservation, maintenance toggle) should call this so the grid, the
 * check-in room list and the DB can never drift apart. Previously each route
 * hand-rolled its own flags, which is how a room could stay "AVAILABLE" while
 * holding a reservation, or stay "RESERVED" months before the guest arrives.
 */
export async function syncRoomStatus(roomId: string, db: Db = prisma) {
  const now = new Date();

  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { id: true, maintenanceStatus: true },
  });
  if (!room) return null;

  const [activeBooking, upcomingReservation] = await Promise.all([
    db.booking.findFirst({
      where: { roomId, status: "CHECKED_IN" },
      select: { id: true },
    }),
    db.booking.findFirst({
      where: {
        roomId,
        status: "RESERVED",
        // Only a reservation that is imminent (or already due) marks the room
        // as RESERVED — a booking three weeks out leaves the room sellable.
        checkInDate: { lte: new Date(now.getTime() + RESERVED_LOOKAHEAD_MS) },
        expectedCheckOut: { gt: now },
      },
      select: { id: true },
    }),
  ]);

  const status = deriveRoomStatus({
    maintenanceStatus: room.maintenanceStatus,
    hasActiveBooking: !!activeBooking,
    hasReservedBooking: !!upcomingReservation,
  });

  return db.room.update({ where: { id: roomId }, data: { status } });
}
