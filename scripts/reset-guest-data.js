/**
 * Start the hotel's records from scratch.
 *
 * Clears guests, bookings, payments, service requests, notifications and
 * expenses, so the dashboard, revenue, pending payments and requests all read
 * zero — as if the hotel opened today.
 *
 * DELIBERATELY KEPT:
 *   - Users (your usernames and passwords are untouched)
 *   - Rooms (all rooms, numbers, types and prices stay)
 *   - Device tokens (so push notifications keep working without re-opening)
 *
 * Do NOT use `npm run db:seed` for this. Seeding deletes every user and room
 * and recreates them with the ORIGINAL default passwords, which would undo any
 * password you have since changed.
 *
 * Usage:
 *   node scripts/reset-guest-data.js            # dry run — shows what WOULD go
 *   node scripts/reset-guest-data.js --apply    # actually clears it
 *   node scripts/reset-guest-data.js --apply --keep-expenses
 */

const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");
const KEEP_EXPENSES = process.argv.includes("--keep-expenses");
const SKIP_BACKUP = process.argv.includes("--no-backup");

function line() {
  console.log("─".repeat(60));
}

async function counts() {
  const [guests, idProofs, bookings, payments, requests, notifications, expenses, rooms, users] =
    await Promise.all([
      prisma.guest.count(),
      prisma.guestIdProof.count(),
      prisma.booking.count(),
      prisma.payment.count(),
      prisma.serviceRequest.count(),
      prisma.notification.count(),
      prisma.expense.count(),
      prisma.room.count(),
      prisma.user.count(),
    ]);
  return { guests, idProofs, bookings, payments, requests, notifications, expenses, rooms, users };
}

/**
 * Write everything being deleted to a JSON file first. ID photos are stored as
 * raw bytes in the database; those are converted to base64 so the backup is a
 * single self-contained file that can be read back if it is ever needed.
 */
async function backup() {
  const [guests, idProofs, bookings, payments, requests, notifications, expenses] =
    await Promise.all([
      prisma.guest.findMany({ omit: { idProofImage: true } }),
      prisma.guestIdProof.findMany(),
      prisma.booking.findMany(),
      prisma.payment.findMany(),
      prisma.serviceRequest.findMany(),
      prisma.notification.findMany(),
      prisma.expense.findMany(),
    ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    note: "Backup taken by scripts/reset-guest-data.js before clearing records.",
    guests,
    idProofs: idProofs.map((p) => ({
      ...p,
      image: p.image ? Buffer.from(p.image).toString("base64") : null,
    })),
    bookings,
    payments,
    serviceRequests: requests,
    notifications,
    expenses,
  };

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const file = path.join(process.cwd(), `backup-before-reset-${stamp}.json`);
  fs.writeFileSync(
    file,
    // Decimal and Date values need coercing to something JSON can hold.
    JSON.stringify(payload, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    2),
  );
  return file;
}

async function main() {
  const before = await counts();

  line();
  console.log("RESET HOTEL RECORDS");
  line();
  console.log("Will be deleted:");
  console.log(`  Guests .............. ${before.guests}`);
  console.log(`  ID photos ........... ${before.idProofs}`);
  console.log(`  Bookings ............ ${before.bookings}`);
  console.log(`  Payments ............ ${before.payments}`);
  console.log(`  Service requests .... ${before.requests}`);
  console.log(`  Notifications ....... ${before.notifications}`);
  console.log(`  Expenses ............ ${KEEP_EXPENSES ? `${before.expenses} (KEEPING)` : before.expenses}`);
  console.log("");
  console.log("Will be KEPT (untouched):");
  console.log(`  Logins / passwords .. ${before.users}`);
  console.log(`  Rooms ............... ${before.rooms}`);
  line();

  if (!APPLY) {
    console.log("This was a DRY RUN. Nothing has been changed.");
    console.log("To actually clear the records, run:");
    console.log("  node scripts/reset-guest-data.js --apply");
    return;
  }

  if (!SKIP_BACKUP) {
    const file = await backup();
    const kb = Math.round(fs.statSync(file).size / 1024);
    console.log(`Backup saved: ${path.basename(file)} (${kb} KB)`);
  }

  // Order matters: children before parents, or the foreign keys refuse.
  // GuestIdProof cascades from Guest, but is cleared explicitly so the count
  // reported at the end is honest.
  await prisma.notification.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.guestIdProof.deleteMany();
  await prisma.guest.deleteMany();
  if (!KEEP_EXPENSES) await prisma.expense.deleteMany();

  // Rooms are kept, but a room still flagged OCCUPIED from a deleted booking
  // would show a phantom guest on the room grid. Put them all back to ready.
  const rooms = await prisma.room.updateMany({
    data: { status: "AVAILABLE", cleaningStatus: "CLEAN", maintenanceStatus: "OK" },
  });

  const after = await counts();

  line();
  console.log("DONE — the hotel's records are now empty.");
  line();
  console.log(`  Guests .............. ${after.guests}`);
  console.log(`  Bookings ............ ${after.bookings}`);
  console.log(`  Payments ............ ${after.payments}`);
  console.log(`  Service requests .... ${after.requests}`);
  console.log(`  Notifications ....... ${after.notifications}`);
  console.log(`  Expenses ............ ${after.expenses}`);
  console.log("");
  console.log(`  Rooms kept .......... ${after.rooms} (all set to Available / Clean)`);
  console.log(`  Logins kept ......... ${after.users} (passwords unchanged)`);
  line();
}

main()
  .catch((error) => {
    console.error("Reset failed — nothing further was changed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
