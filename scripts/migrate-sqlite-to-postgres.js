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

function readSqliteTable(table) {
  // Uses the sqlite3 CLI in JSON mode so we don't need a native driver.
  const out = execFileSync("sqlite3", [SQLITE_PATH, "-json", `SELECT * FROM "${table}";`], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
  return out ? JSON.parse(out) : [];
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

  for (const [table, upsert] of steps) {
    let rows = [];
    try {
      rows = readSqliteTable(table);
    } catch {
      console.log(`  ${table.padEnd(18)} — table not present in SQLite, skipped`);
      continue;
    }
    for (const row of rows) await upsert(row);
    console.log(`  ${table.padEnd(18)} ${String(rows.length).padStart(4)} row(s) copied`);
  }

  console.log("\nDone. Verify with: npx prisma studio");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("\nMigration failed:", err.message);
  process.exit(1);
});
