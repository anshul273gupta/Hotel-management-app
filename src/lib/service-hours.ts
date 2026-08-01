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
