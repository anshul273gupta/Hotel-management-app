import { getUpcomingBookings } from "@/lib/bookings";
import { BookingsCalendar } from "@/components/bookings/bookings-calendar";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const bookings = await getUpcomingBookings();
  const reservedCount = bookings.filter((b) => b.status === "RESERVED").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Bookings Calendar
        </h1>
        <p className="text-sm text-muted-foreground">
          {reservedCount} upcoming reservation{reservedCount === 1 ? "" : "s"} · pick a date to see arrivals and stays
        </p>
      </div>

      <BookingsCalendar bookings={bookings} />
    </div>
  );
}
