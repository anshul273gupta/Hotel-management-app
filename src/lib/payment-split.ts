/**
 * Spreading one payment across several rooms on a single check-in.
 *
 * A guest taking two rooms hands over one amount for the whole stay. The
 * booking is stored per room, so that amount has to be attributed somehow.
 *
 * It used to be divided equally, which is wrong whenever the rooms cost
 * different amounts. Two rooms at ₹2,000 and ₹2,500, paid ₹4,500 in full,
 * became ₹2,250 against each: the cheaper room looked ₹250 overpaid and the
 * dearer one looked ₹250 short, so a fully settled stay sat in Pending
 * Payments for ever. The totals matched, so it was invisible on the dashboard
 * and only showed on the room cards.
 *
 * Instead each room is credited what it actually owes, in order, until the
 * money runs out. Every fully paid stay then reads as paid, and a part payment
 * leaves the shortfall on one room rather than smeared across all of them.
 *
 * Works in paise internally so repeated division cannot lose a rupee.
 */
export function allocatePaymentToRooms(totalPaid: number, roomTotals: number[]): number[] {
  if (roomTotals.length === 0) return [];

  const safePaid = Number.isFinite(totalPaid) ? Math.max(0, totalPaid) : 0;
  if (roomTotals.length === 1) return [Math.round(safePaid * 100) / 100];

  const dues = roomTotals.map((t) => Math.max(0, Math.round((Number(t) || 0) * 100)));
  let remaining = Math.round(safePaid * 100);

  const allocated = dues.map((due) => {
    const take = Math.min(remaining, due);
    remaining -= take;
    return take;
  });

  // Anything still left is a genuine overpayment. The forms warn before this
  // happens, but if it does the money is shown rather than silently dropped.
  if (remaining > 0) allocated[allocated.length - 1] += remaining;

  return allocated.map((paise) => paise / 100);
}

/** What each room costs for the whole stay: nightly rate × nights. */
export function roomStayTotals(rates: Array<number | string | undefined>, nights: number): number[] {
  const safeNights = Math.max(1, Math.round(nights) || 1);
  return rates.map((rate) => (Number(rate) || 0) * safeNights);
}
