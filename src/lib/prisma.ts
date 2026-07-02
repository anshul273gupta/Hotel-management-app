import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  client.$connect().then(async () => {
    const pragmas = [
      "PRAGMA journal_mode = WAL;",
      "PRAGMA synchronous = NORMAL;",
      "PRAGMA cache_size = -32000;",
      "PRAGMA temp_store = MEMORY;",
      "PRAGMA mmap_size = 268435456;",
      "PRAGMA busy_timeout = 5000;",
    ];
    for (const p of pragmas) {
      await client.$queryRawUnsafe(p).catch(() => {});
    }
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma;
