#!/usr/bin/env node
/**
 * One-time data migration: copies everything from the old SQLite file
 * (prisma/hotel.db) into the Postgres database pointed at by DATABASE_URL.
 *
 *   node scripts/migrate-sqlite-to-postgres.js
 *
 * Safe to re-run: rows are upserted by primary key, so an interrupted run can
 * simply be started again. Tables are written parents-first so foreign keys
 * always resolve.
 */

const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");
const { PrismaClient } = require("@prisma/client");

const SQLITE_PATH = path.join(__dirname, "..", "prisma", "hotel.db");

/**
 * Opens the SQLite file using whichever reader is available:
 *   1. node:sqlite  — built into Node 22.5+ / 24, nothing to install (Windows friendly)
 *   2. the sqlite3 command-line tool — common on Linux/macOS
 *
 * Returns a function that reads one table, or throws if neither is available.
 */
function makeReader() {
  // Preferred: the built-in module. No external command needed.
  try {
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(SQLITE_PATH, { readOnly: true });
    console.log("  (reading with Node's built-in SQLite support)\n");
    return {
      tables: () =>
        db
          .prepare("SELECT name FROM sqlite_master WHERE type='table'")
          .all()
          .map((r) => r.name),
      read: (table) => db.prepare(`SELECT * FROM "${table}"`).all(),
    };
  } catch (err) {
    if (err && err.code !== "ERR_UNKNOWN_BUILTIN_MODULE" && !/Cannot find module/.test(err.message)) {
      // The module exists but the file itself failed to open — that's fatal.
      throw new Error(`Could not open ${SQLITE_PATH}: ${err.message}`);
    }
  }

  // Fallback: the sqlite3 CLI.
  try {
    execFileSync("sqlite3", ["-version"], { stdio: "ignore" });
  } catch {
    throw new Error(
      "No way to read the SQLite file.\n" +
        "        Either use Node 22.5 or newer (it has SQLite built in),\n" +
        "        or install the sqlite3 command-line tool.",
    );
  }
  console.log("  (reading with the sqlite3 command-line tool)\n");
  const q = (sql) => {
    const out = execFileSync("sqlite3", [SQLITE_PATH, "-json", sql], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }).trim();
    return out ? JSON.parse(out) : [];
  };
  return {
    tables: () => q("SELECT name FROM sqlite_master WHERE type='table';").map((r) => r.name),
    read: (table) => q(`SELECT * FROM "${table}";`),
  };
}

/** SQLite stores datetimes as epoch-ms integers or ISO strings. */
function toDate(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return new Date(value);
  const asNumber = Number(value);
  if (!Number.isNaN(asNumber) && String(value).trim() !== "") return new Date(asNumber);
  return new Date(value);
}

function toBool(value) {
  return value === 1 || value === true || value === "1";
}

async function main() {
  if (!fs.existsSync(SQLITE_PATH)) {
    console.error(`No SQLite database found at ${SQLITE_PATH} — nothing to migrate.`);
    process.exit(1);
  }
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith("postgres")) {
    console.error("DATABASE_URL must point at your Postgres database before running this.");
    process.exit(1);
  }

  const reader = makeReader();
  const present = new Set(reader.tables());

  const prisma = new PrismaClient();

  // Parents before children so every foreign key has something to point at.
  const steps = [
    ["users", (r) => prisma.user.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id, name: r.name, email: r.email, username: r.username ?? null,
        phone: r.phone ?? null, passwordHash: r.passwordHash, role: r.role,
        createdAt: toDate(r.createdAt) ?? new Date(),
      },
    })],
    ["rooms", (r) => prisma.room.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id, number: r.number, type: r.type, floor: r.floor,
        basePrice: r.basePrice, cleaningStatus: r.cleaningStatus,
        maintenanceStatus: r.maintenanceStatus, status: r.status, qrToken: r.qrToken,
        createdAt: toDate(r.createdAt) ?? new Date(),
        updatedAt: toDate(r.updatedAt) ?? new Date(),
      },
    })],
    ["guests", (r) => prisma.guest.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id, title: r.title ?? null, name: r.name, mobile: r.mobile,
        address: r.address ?? null, idProofType: r.idProofType ?? null,
        idProofNumber: r.idProofNumber ?? null, idProofUrl: r.idProofUrl ?? null,
        specialRequests: r.specialRequests ?? null,
        createdAt: toDate(r.createdAt) ?? new Date(),
        updatedAt: toDate(r.updatedAt) ?? new Date(),
      },
    })],
    ["bookings", (r) => prisma.booking.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id, guestId: r.guestId, roomId: r.roomId,
        numberOfGuests: r.numberOfGuests,
        checkInDate: toDate(r.checkInDate) ?? new Date(),
        expectedCheckOut: toDate(r.expectedCheckOut) ?? new Date(),
        actualCheckOut: toDate(r.actualCheckOut),
        status: r.status, roomRate: r.roomRate, totalAmount: r.totalAmount,
        amountPaid: r.amountPaid, paymentStatus: r.paymentStatus,
        paymentReminderSentAt: toDate(r.paymentReminderSentAt),
        notes: r.notes ?? null, createdById: r.createdById,
        createdAt: toDate(r.createdAt) ?? new Date(),
        updatedAt: toDate(r.updatedAt) ?? new Date(),
      },
    })],
    ["payments", (r) => prisma.payment.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id, bookingId: r.bookingId, amount: r.amount, method: r.method,
        status: r.status, paidAt: toDate(r.paidAt) ?? new Date(),
        recordedById: r.recordedById, createdAt: toDate(r.createdAt) ?? new Date(),
      },
    })],
    ["expenses", (r) => prisma.expense.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id, category: r.category, description: r.description ?? null,
        amount: r.amount, date: toDate(r.date) ?? new Date(),
        createdById: r.createdById, createdAt: toDate(r.createdAt) ?? new Date(),
      },
    })],
    ["service_requests", (r) => prisma.serviceRequest.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id, roomId: r.roomId, type: r.type, description: r.description ?? null,
        photoUrl: r.photoUrl ?? null, status: r.status,
        assignedToId: r.assignedToId ?? null, notes: r.notes ?? null,
        rating: r.rating ?? null, ratingComment: r.ratingComment ?? null,
        createdAt: toDate(r.createdAt) ?? new Date(),
        assignedAt: toDate(r.assignedAt), completedAt: toDate(r.completedAt),
        updatedAt: toDate(r.updatedAt) ?? new Date(),
      },
    })],
    ["device_tokens", (r) => prisma.deviceToken.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id, token: r.token,
        createdAt: toDate(r.createdAt) ?? new Date(),
        updatedAt: toDate(r.updatedAt) ?? new Date(),
      },
    })],
    ["notifications", (r) => prisma.notification.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id, type: r.type, title: r.title, message: r.message,
        link: r.link ?? null, read: toBool(r.read),
        targetRole: r.targetRole ?? null,
        createdAt: toDate(r.createdAt) ?? new Date(),
      },
    })],
  ];

  let totalCopied = 0;

  for (const [table, upsert] of steps) {
    if (!present.has(table)) {
      console.log(`  ${table.padEnd(18)} — not in the SQLite file, skipped`);
      continue;
    }

    const rows = reader.read(table);
    let copied = 0;
    for (const row of rows) {
      try {
        await upsert(row);
        copied++;
      } catch (err) {
        console.log(`  ${table.padEnd(18)} ! row ${row.id ?? "?"} failed: ${err.message.split("\n")[0]}`);
      }
    }
    totalCopied += copied;
    console.log(`  ${table.padEnd(18)} ${String(copied).padStart(4)} of ${rows.length} row(s) copied`);
  }

  if (totalCopied === 0) {
    console.log(
      "\nNothing was copied. The SQLite file appears to be empty —" +
        "\nrun `npm run db:seed` instead to create the rooms and login accounts.",
    );
  } else {
    console.log(`\nDone — ${totalCopied} row(s) imported. Verify with: npx prisma studio`);
  }
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("\nMigration failed:", err.message);
  process.exit(1);
});
