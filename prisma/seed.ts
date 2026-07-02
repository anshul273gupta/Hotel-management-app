import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Clearing existing data...");
  await prisma.deviceToken.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();

  console.log("Creating users...");
  const managerHash = await bcrypt.hash("manager123", 10);
  const ownerHash = await bcrypt.hash("AI9406851411", 10);

  await prisma.user.create({
    data: {
      name: "Manager",
      email: "manager@hotel.com",
      phone: "7342551411",
      username: "Hotel Agrawal Inn",
      passwordHash: managerHash,
      role: "MANAGER",
    },
  });

  await prisma.user.create({
    data: {
      name: "Anand Gupta",
      email: "owner@hotel.com",
      phone: "7342551411",
      username: "Hotel Agrawal Inn",
      passwordHash: ownerHash,
      role: "OWNER",
    },
  });

  console.log("Creating rooms...");
  await prisma.room.createMany({
    data: [
      { number: "101", type: "DELUXE",  floor: 1, basePrice: 2500, cleaningStatus: "CLEAN", maintenanceStatus: "OK", status: "AVAILABLE" },
      { number: "102", type: "DELUXE",  floor: 1, basePrice: 2500, cleaningStatus: "CLEAN", maintenanceStatus: "OK", status: "AVAILABLE" },
      { number: "103", type: "DELUXE",  floor: 1, basePrice: 2500, cleaningStatus: "CLEAN", maintenanceStatus: "OK", status: "AVAILABLE" },
      { number: "104", type: "PREMIUM", floor: 1, basePrice: 4000, cleaningStatus: "CLEAN", maintenanceStatus: "OK", status: "AVAILABLE" },
      { number: "201", type: "PREMIUM", floor: 2, basePrice: 4000, cleaningStatus: "CLEAN", maintenanceStatus: "OK", status: "AVAILABLE" },
      { number: "202", type: "PREMIUM", floor: 2, basePrice: 4000, cleaningStatus: "CLEAN", maintenanceStatus: "OK", status: "AVAILABLE" },
      { number: "203", type: "SUITE",   floor: 2, basePrice: 6500, cleaningStatus: "CLEAN", maintenanceStatus: "OK", status: "AVAILABLE" },
      { number: "204", type: "DELUXE",  floor: 2, basePrice: 2500, cleaningStatus: "CLEAN", maintenanceStatus: "OK", status: "AVAILABLE" },
      { number: "205", type: "SUITE",   floor: 2, basePrice: 6500, cleaningStatus: "CLEAN", maintenanceStatus: "OK", status: "AVAILABLE" },
      { number: "206", type: "SUITE",   floor: 2, basePrice: 6500, cleaningStatus: "CLEAN", maintenanceStatus: "OK", status: "AVAILABLE" },
      { number: "207", type: "PREMIUM", floor: 2, basePrice: 4000, cleaningStatus: "CLEAN", maintenanceStatus: "OK", status: "AVAILABLE" },
      { number: "208", type: "DELUXE",  floor: 2, basePrice: 2500, cleaningStatus: "CLEAN", maintenanceStatus: "OK", status: "AVAILABLE" },
    ],
  });

  console.log("Seed complete — fresh start.");
  console.log("  Manager: Hotel Agrawal Inn / manager123");
  console.log("  Owner:   Hotel Agrawal Inn / AI9406851411");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
