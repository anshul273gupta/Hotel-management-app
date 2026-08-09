import "server-only";
import { prisma } from "@/lib/prisma";
import { syncRoomStatus } from "@/lib/rooms";
import { createNotification, broadcastUpdate } from "@/lib/notifications";
import { toDecimalNumber } from "@/lib/format";
import { HOTEL_TIMEZONE } from "@/lib/service-hours";

/** How long before check-out staff are warned about an unpaid balance. */
const PAYMENT_REMINDER_WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * Auto check-in reservations whose check-in time has arrived, and auto
 * check-out stays whose expected check-out time has passed. Walk-in
 * bookings start as CHECKED_IN already, so only the check-out half applies
 * to them; advance bookings go through both transitions.
 *
 * Stays with an outstanding balance are never auto checked-out — they stay
 * highlighted on the room grid until staff settle the payment and check the
 * guest out manually. A reminder notification fires once, 2 hours before the
 * expected check-out, for any checked-in stay that still has payment due.
 */
export async function processAutomaticBookingTransitions() {
  const now = new Date();
  let checkedOut = 0;
  let paymentReminders = 0;

  // Note: RESERVED bookings due for check-in are handled manually via the
  // ArrivalCheckAlert component — staff confirms each arrival in the dashboard.

  const dueCheckOuts = await prisma.booking.findMany({
    where: { status: "CHECKED_IN", expectedCheckOut: { lte: now }, paymentStatus: "PAID" },
    include: { guest: true, room: true },
  });

  for (const booking of dueCheckOuts) {
    // Guard against concurrent runs: only proceed if still CHECKED_IN
    const updated = await prisma.booking.updateMany({
      where: { id: booking.id, status: "CHECKED_IN" },
      data: { status: "CHECKED_OUT", actualCheckOut: now },
    });
    if (updated.count === 0) continue;

    await prisma.room.update({
      where: { id: booking.roomId },
      data: { cleaningStatus: "CLEAN" },
    });
    await syncRoomStatus(booking.roomId);

    await createNotification({
      type: "CHECK_OUT",
      title: `${booking.guest.name} auto checked out of Room ${booking.room.number}`,
      message: "Expected check-out time reached",
      link: "/rooms",
    });

    checkedOut++;
  }

  const dueReminders = await prisma.booking.findMany({
    where: {
      status: "CHECKED_IN",
      paymentStatus: { not: "PAID" },
      paymentReminderSentAt: null,
      expectedCheckOut: { lte: new Date(now.getTime() + PAYMENT_REMINDER_WINDOW_MS) },
    },
    include: { guest: true, room: true },
  });

  for (const booking of dueReminders) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { paymentReminderSentAt: now },
    });

    const outstanding = toDecimalNumber(booking.totalAmount) - toDecimalNumber(booking.amountPaid);

    // Round to whole rupees and group in the Indian style, so the figure reads
    // the way staff would say it out loud.
    const amount = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(outstanding);

    const dueAt = new Intl.DateTimeFormat("en-IN", {
      timeZone: HOTEL_TIMEZONE,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(booking.expectedCheckOut);

    const minutesLeft = Math.round(
      (booking.expectedCheckOut.getTime() - now.getTime()) / 60000,
    );
    const timing =
      minutesLeft <= 0
        ? "is due now"
        : minutesLeft < 60
          ? `is due in ${minutesLeft} minutes`
          : `is due at ${dueAt}`;

    await createNotification({
      type: "PENDING_PAYMENT",
      title: `Collect ${amount} — Room ${booking.room.number}`,
      message: `${booking.guest.name} still has ${amount} outstanding and their check-out ${timing}. Please settle the balance before they leave.`,
      link: "/rooms",
    });

    paymentReminders++;
  }

  // Reservations become "imminent" purely with the passage of time, so refresh
  // the affected rooms on each sweep — otherwise a room booked for tomorrow
  // would keep showing AVAILABLE until someone edited it by hand.
  const roomsWithReservations = await prisma.booking.findMany({
    where: { status: "RESERVED", expectedCheckOut: { gt: now } },
    select: { roomId: true },
    distinct: ["roomId"],
  });
  for (const { roomId } of roomsWithReservations) {
    await syncRoomStatus(roomId);
  }

  if (checkedOut > 0 || paymentReminders > 0 || roomsWithReservations.length > 0) {
    broadcastUpdate("rooms-updated");
    broadcastUpdate("bookings-updated");
    broadcastUpdate("dashboard-updated");
    broadcastUpdate("guests-updated");
  }

  return { checkedOut, paymentReminders };
}
