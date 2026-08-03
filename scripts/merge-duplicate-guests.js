#!/usr/bin/env node
/**
 * Merges guest records that are clearly the same person.
 *
 * While the mobile number was optional but unmatched, every booking without
 * one created a fresh guest, so a repeat walk-in could appear several times in
 * the register. This folds those together and moves their bookings onto a
 * single record.
 *
 *   node scripts/merge-duplicate-guests.js            # report only
 *   node scripts/merge-duplicate-guests.js --apply    # actually merge
 *
 * Guests are grouped by identical name (case-insensitive). A group is only
 * merged when at most one of its records has a mobile number — that covers the
 * same person booked once with a number and once without. If two records share
 * a name but have different numbers they are treated as different people and
 * left alone.
 */

const { PrismaClient } = require("@prisma/client");

const APPLY = process.argv.includes("--apply");

async function main() {
  if (!process.env.DATABASE_URL) {
    try {
      const fs = require("fs");
      for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
        if (m) process.env[m[1]] ??= m[2];
      }
    } catch {
      console.error("No .env found and DATABASE_URL is not set.");
      process.exit(1);
    }
  }

  const prisma = new PrismaClient();

  const guests = await prisma.guest.findMany({
    include: { _count: { select: { bookings: true } } },
    orderBy: { createdAt: "asc" },
  });

  const groups = new Map();
  for (const g of guests) {
    const key = g.name.trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(g);
  }

  const duplicates = [...groups.entries()].filter(([, list]) => {
    if (list.length < 2) return false;
    // Distinct phone numbers mean distinct people, however alike the names.
    const numbers = new Set(list.map((g) => g.mobile).filter(Boolean));
    return numbers.size <= 1;
  });

  if (duplicates.length === 0) {
    console.log("No duplicate guests found.");
    await prisma.$disconnect();
    return;
  }

  console.log(
    `${APPLY ? "Merging" : "Would merge"} ${duplicates.length} duplicated name(s):\n`,
  );

  let moved = 0;
  let removed = 0;

  for (const [, list] of duplicates) {
    // Prefer the record that carries the phone number; otherwise the oldest,
    // which is what earlier bookings already point at.
    const withNumber = list.find((g) => g.mobile);
    const keep = withNumber ?? list[0];
    const rest = list.filter((g) => g.id !== keep.id);
    const totalBookings = list.reduce((n, g) => n + g._count.bookings, 0);
    console.log(
      `  ${keep.name}: ${list.length} records, ${totalBookings} booking(s) -> keeping ${keep.id}`,
    );

    if (!APPLY) continue;

    for (const dup of rest) {
      const res = await prisma.booking.updateMany({
        where: { guestId: dup.id },
        data: { guestId: keep.id },
      });
      moved += res.count;

      // Carry over any detail the kept record is missing.
      await prisma.guest.update({
        where: { id: keep.id },
        data: {
          mobile: keep.mobile ?? dup.mobile ?? undefined,
          address: keep.address ?? dup.address ?? undefined,
          idProofType: keep.idProofType ?? dup.idProofType ?? undefined,
          idProofNumber: keep.idProofNumber ?? dup.idProofNumber ?? undefined,
          specialRequests: keep.specialRequests ?? dup.specialRequests ?? undefined,
        },
      });

      await prisma.guest.delete({ where: { id: dup.id } });
      removed++;
    }
  }

  console.log(
    APPLY
      ? `\nDone — ${moved} booking(s) moved, ${removed} duplicate record(s) removed.`
      : "\nRun again with --apply to perform the merge.",
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});
