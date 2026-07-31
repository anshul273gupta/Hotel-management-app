"use client";

import { useMemo, useState, type ReactNode } from "react";
import { LogIn, LogOut, BedDouble, CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardAction, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS } from "@/lib/constants";
import type { UpcomingBooking } from "@/lib/bookings";

function startOfDay(date: Date | string) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(date: Date | string) {
  return startOfDay(date).getTime();
}

function isWithinStay(day: Date, checkIn: Date | string, checkOut: Date | string) {
  const time = startOfDay(day).getTime();
  return time >= startOfDay(checkIn).getTime() && time < startOfDay(checkOut).getTime();
}

type DayInfo = {
  occupied: boolean;
  reserved: boolean;
  arrivals: UpcomingBooking[];
  departures: UpcomingBooking[];
};

export function BookingsCalendar({ bookings }: { bookings: UpcomingBooking[] }) {
  const today = startOfDay(new Date());
  const [selected, setSelected] = useState<Date>(today);
  const [month, setMonth] = useState<Date>(today);

  const dayInfo = useMemo(() => {
    const map = new Map<number, DayInfo>();

    function entry(key: number) {
      let value = map.get(key);
      if (!value) {
        value = { occupied: false, reserved: false, arrivals: [], departures: [] };
        map.set(key, value);
      }
      return value;
    }

    for (const booking of bookings) {
      const start = startOfDay(booking.checkInDate);
      const end = startOfDay(booking.expectedCheckOut);

      for (const d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        const value = entry(d.getTime());
        if (booking.status === "CHECKED_IN") value.occupied = true;
        if (booking.status === "RESERVED") value.reserved = true;
      }

      entry(start.getTime()).arrivals.push(booking);
      entry(end.getTime()).departures.push(booking);
    }

    return map;
  }, [bookings]);

  const selectedInfo = dayInfo.get(dayKey(selected));
  const arrivals = selectedInfo?.arrivals ?? [];
  const departures = selectedInfo?.departures ?? [];
  const staying = useMemo(
    () =>
      bookings.filter(
        (b) => isWithinStay(selected, b.checkInDate, b.expectedCheckOut) && dayKey(b.checkInDate) !== dayKey(selected),
      ),
    [bookings, selected],
  );

  const upcoming = useMemo(
    () =>
      bookings
        .filter((b) => b.status === "RESERVED")
        .sort((a, b) => new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime()),
    [bookings],
  );

  function goToBooking(booking: UpcomingBooking) {
    const date = startOfDay(booking.checkInDate);
    setSelected(date);
    setMonth(date);
  }

  function goToToday() {
    setSelected(today);
    setMonth(today);
  }

  function relativeDayLabel(date: Date | string) {
    const diffDays = Math.round((dayKey(date) - dayKey(today)) / 86_400_000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays > 1 && diffDays < 7) return `In ${diffDays} days`;
    return formatDate(date);
  }

  const hasBookingsOnSelectedDay = arrivals.length > 0 || departures.length > 0 || staying.length > 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
      <Card className="w-fit">
        <CardHeader>
          <CardTitle className="text-base">Calendar</CardTitle>
          <CardAction>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3 p-2 pt-0">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => date && setSelected(date)}
            month={month}
            onMonthChange={setMonth}
            modifiers={{
              occupied: (day) => dayInfo.get(dayKey(day))?.occupied ?? false,
              reserved: (day) => {
                const info = dayInfo.get(dayKey(day));
                return !!info && info.reserved && !info.occupied;
              },
              arrival: (day) => (dayInfo.get(dayKey(day))?.arrivals.length ?? 0) > 0,
              departure: (day) => (dayInfo.get(dayKey(day))?.departures.length ?? 0) > 0,
            }}
            modifiersClassNames={{
              occupied: "bg-emerald-100 dark:bg-emerald-950/40",
              reserved: "bg-sky-100 dark:bg-sky-950/40",
              arrival:
                "relative after:absolute after:bottom-1 after:left-[35%] after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:rounded-full after:bg-green-500 after:content-[''] dark:after:bg-green-400",
              departure:
                "relative before:absolute before:bottom-1 before:left-[65%] before:h-1.5 before:w-1.5 before:-translate-x-1/2 before:rounded-full before:bg-amber-500 before:content-[''] dark:before:bg-amber-400",
            }}
          />
          <div className="space-y-1.5 border-t px-2 pt-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">How to read this calendar</p>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 dark:bg-emerald-800" /> Guest staying (checked in)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-300 dark:bg-sky-800" /> Reserved (not checked in yet)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 dark:bg-green-400" /> Green dot = guest arriving
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400" /> Amber dot = guest leaving
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {formatDate(selected)}
              {dayKey(selected) === dayKey(today) && <Badge variant="secondary">Today</Badge>}
            </CardTitle>
            <CardDescription>Tap any date on the calendar to see what&apos;s happening that day</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasBookingsOnSelectedDay ? (
              <p className="text-sm text-muted-foreground">No bookings for this date.</p>
            ) : (
              <>
                {arrivals.length > 0 && (
                  <BookingSection
                    icon={<LogIn className="h-4 w-4" />}
                    label={`Arriving (${arrivals.length})`}
                    className="text-green-700 dark:text-green-400"
                    bookings={arrivals}
                  />
                )}
                {departures.length > 0 && (
                  <BookingSection
                    icon={<LogOut className="h-4 w-4" />}
                    label={`Leaving (${departures.length})`}
                    className="text-amber-700 dark:text-amber-400"
                    bookings={departures}
                  />
                )}
                {staying.length > 0 && (
                  <BookingSection
                    icon={<BedDouble className="h-4 w-4" />}
                    label={`Staying through (${staying.length})`}
                    className="text-emerald-700 dark:text-emerald-400"
                    bookings={staying}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" /> Upcoming Reservations
            </CardTitle>
            <CardDescription>Tap a reservation to jump to its arrival date</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming reservations.</p>
            ) : (
              upcoming.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => goToBooking(b)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/60"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      Room {b.room.number} · {b.guest.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {relativeDayLabel(b.checkInDate)} · {formatDate(b.checkInDate)} → {formatDate(b.expectedCheckOut)}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {formatCurrency(b.amountPaid)} / {formatCurrency(b.totalAmount)}
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BookingSection({
  icon,
  label,
  className,
  bookings,
}: {
  icon: ReactNode;
  label: string;
  className: string;
  bookings: UpcomingBooking[];
}) {
  return (
    <div className="space-y-2">
      <p className={`flex items-center gap-1.5 text-sm font-medium ${className}`}>
        {icon}
        {label}
      </p>
      {bookings.map((b) => (
        <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium">
              Room {b.room.number} · {b.guest.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDate(b.checkInDate)} → {formatDate(b.expectedCheckOut)}{b.guest.mobile ? ` · ${b.guest.mobile}` : ""}
            </p>
          </div>
          <Badge className={`${PAYMENT_STATUS_COLORS[b.paymentStatus]} border-0`}>
            {PAYMENT_STATUS_LABELS[b.paymentStatus]}
          </Badge>
        </div>
      ))}
    </div>
  );
}
