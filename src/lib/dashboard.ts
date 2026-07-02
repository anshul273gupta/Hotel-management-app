import { prisma } from "@/lib/prisma";
import { toDecimalNumber } from "@/lib/format";

function dayRange(date: Date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function getDashboardSummary() {
  const { start, end } = dayRange();

  const [
    roomsOccupied,
    roomsVacant,
    checkInsToday,
    checkOutsToday,
    totalGuestsStaying,
    revenueToday,
    pendingBookings,
  ] = await Promise.all([
    prisma.room.count({ where: { status: "OCCUPIED" } }),
    prisma.room.count({ where: { status: "AVAILABLE" } }),
    prisma.booking.count({
      where: { checkInDate: { gte: start, lt: end }, status: { not: "CANCELLED" } },
    }),
    prisma.booking.count({
      where: { expectedCheckOut: { gte: start, lt: end }, status: { not: "CANCELLED" } },
    }),
    prisma.booking.aggregate({
      where: { status: "CHECKED_IN" },
      _sum: { numberOfGuests: true },
    }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: start, lt: end }, status: "PAID" },
      _sum: { amount: true },
    }),
    prisma.booking.findMany({
      where: { paymentStatus: { in: ["PARTIAL", "PENDING"] }, status: { not: "CANCELLED" } },
      select: { totalAmount: true, amountPaid: true },
    }),
  ]);

  const pendingPaymentsTotal = pendingBookings.reduce(
    (sum, b) => sum + (toDecimalNumber(b.totalAmount) - toDecimalNumber(b.amountPaid)),
    0,
  );

  return {
    roomsOccupied,
    roomsVacant,
    checkInsToday,
    checkOutsToday,
    totalGuestsStaying: totalGuestsStaying._sum.numberOfGuests ?? 0,
    revenueToday: toDecimalNumber(revenueToday._sum.amount),
    pendingPaymentsTotal,
    pendingPaymentsCount: pendingBookings.length,
  };
}

export type DashboardSummary = Awaited<ReturnType<typeof getDashboardSummary>>;

export async function getDashboardDetails() {
  const { start, end } = dayRange();

  const [todaysCheckIns, todaysCheckOuts, pendingPayments] = await Promise.all([
    prisma.booking.findMany({
      where: { checkInDate: { gte: start, lt: end }, status: { not: "CANCELLED" } },
      include: { guest: true, room: true },
      orderBy: { checkInDate: "desc" },
      take: 8,
    }),
    prisma.booking.findMany({
      where: { expectedCheckOut: { gte: start, lt: end }, status: { not: "CANCELLED" } },
      include: { guest: true, room: true },
      orderBy: { expectedCheckOut: "asc" },
      take: 8,
    }),
    prisma.booking.findMany({
      where: { paymentStatus: { in: ["PARTIAL", "PENDING"] }, status: { not: "CANCELLED" } },
      include: { guest: true, room: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return {
    todaysCheckIns,
    todaysCheckOuts,
    pendingPayments,
  };
}

export type DashboardDetails = Awaited<ReturnType<typeof getDashboardDetails>>;
