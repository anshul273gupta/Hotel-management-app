import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // PRAGMA tuning used to run here for SQLite. Those statements are invalid on
  // PostgreSQL and logged a "syntax error at or near PRAGMA" on every cold
  // start, so they've been removed — Postgres needs no equivalent setup.
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma;
