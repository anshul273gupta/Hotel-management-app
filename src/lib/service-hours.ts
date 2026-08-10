/**
 * Service availability windows, evaluated in the hotel's own timezone.
 *
 * The server runs in UTC on Vercel, so `new Date().getHours()` returns a time
 * 5h30m behind Indore. A guest scanning at 2pm IST was seeing 8am on the
 * server and being told service hours were over.
 */

export const HOTEL_TIMEZONE = process.env.HOTEL_TIMEZONE ?? "Asia/Kolkata";

/** General room-service window: 9:00 AM – 9:00 PM. */
export const SERVICE_START_HOUR = 9;
export const SERVICE_END_HOUR = 21;

/** Housekeeping runs two shifts: 9:00 AM – 12:00 PM and 4:00 PM – 6:00 PM. */
export const HOUSEKEEPING_SHIFTS = [
  { start: 9, end: 12, label: "9:00 AM – 12:00 PM" },
  { start: 16, end: 18, label: "4:00 PM – 6:00 PM" },
] as const;

/** Minutes since midnight in the hotel's timezone, regardless of server locale. */
export function hotelMinutesNow(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: HOTEL_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function isWithinServiceHours(now: Date = new Date()): boolean {
  const minutes = hotelMinutesNow(now);
  return minutes >= SERVICE_START_HOUR * 60 && minutes < SERVICE_END_HOUR * 60;
}

export function isHousekeepingOpen(now: Date = new Date()): boolean {
  const minutes = hotelMinutesNow(now);
  return HOUSEKEEPING_SHIFTS.some(
    (shift) => minutes >= shift.start * 60 && minutes < shift.end * 60,
  );
}

/** Human-readable windows for the guest-facing copy. */
export const SERVICE_HOURS_LABEL = "9:00 AM to 9:00 PM";
export const HOUSEKEEPING_HOURS_LABEL = HOUSEKEEPING_SHIFTS.map((s) => s.label).join(" and ");

/** Describes when housekeeping next opens, for the disabled-button hint. */
export function nextHousekeepingWindow(now: Date = new Date()): string {
  const minutes = hotelMinutesNow(now);
  const upcoming = HOUSEKEEPING_SHIFTS.find((shift) => minutes < shift.start * 60);
  return upcoming ? upcoming.label : HOUSEKEEPING_SHIFTS[0].label + " tomorrow";
}

/**
 * Parses a `YYYY-MM-DDTHH:mm` value from a date/time input as hotel-local time.
 *
 * `new Date("2026-08-07T09:00")` resolves against the *server's* zone. On
 * Vercel that is UTC, so a 9:00 AM check-out entered in Indore was stored as
 * 9:00 UTC and read back as 2:30 PM — staff saw a time they never chose.
 *
 * Anchoring on the same wall-clock instant in UTC and measuring the zone's
 * offset at that moment keeps the arithmetic correct across DST boundaries,
 * even though India itself has none.
 */
export function parseHotelDateTime(value: string): Date {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!match) return new Date(value);

  const [, y, mo, d, h = "0", mi = "0"] = match;
  const asUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));

  // How far the hotel's zone sits from UTC at that instant.
  const probe = new Date(asUtc);
  const local = new Date(probe.toLocaleString("en-US", { timeZone: HOTEL_TIMEZONE }));
  const utc = new Date(probe.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMs = local.getTime() - utc.getTime();

  return new Date(asUtc - offsetMs);
}

/**
 * Nights charged for a stay, counted as calendar nights in the hotel's own
 * timezone.
 *
 * Previously this rounded up the elapsed time: Math.ceil(hours / 24). Checking
 * in at 9:20am and leaving at 10:00am the next morning is 24.7 hours, which
 * rounded up to 2 nights and billed the guest twice for a one-night stay. Any
 * check-in later in the morning than the check-out time had the same problem.
 *
 * Hotels charge per date crossed, not per 24 hours, so the dates are compared
 * instead — and in Asia/Kolkata, because the server runs in UTC where the
 * date rolls over 5h30m late.
 */
export function nightsBetween(checkIn: Date, checkOut: Date): number {
  const dateOnly = (d: Date) => {
    const s = new Intl.DateTimeFormat("en-CA", {
      timeZone: HOTEL_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
    return new Date(`${s}T00:00:00Z`).getTime();
  };

  const diffDays = Math.round((dateOnly(checkOut) - dateOnly(checkIn)) / 86_400_000);
  // A same-day stay (day use) still counts as one night's charge.
  return Math.max(1, diffDays);
}
