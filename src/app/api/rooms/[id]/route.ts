import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { syncRoomStatus } from "@/lib/rooms";
import { createNotification, broadcastUpdate } from "@/lib/notifications";

const schema = z.object({
  cleaningStatus: z.enum(["CLEAN", "CLEANING_IN_PROGRESS", "DIRTY"]).optional(),
  maintenanceStatus: z.enum(["OK", "NEEDS_MAINTENANCE", "UNDER_MAINTENANCE"]).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      bookings: {
        where: { status: { in: ["CHECKED_IN", "RESERVED"] } },
        select: { id: true, status: true },
      },
    },
  });
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const hasCheckedIn = room.bookings.some((b) => b.status === "CHECKED_IN");
  if (hasCheckedIn) {
    return NextResponse.json(
      { error: "Cannot update cleaning or maintenance status while the room is occupied" },
      { status: 400 },
    );
  }

  const cleaningStatus = parsed.data.cleaningStatus ?? room.cleaningStatus;
  const maintenanceStatus = parsed.data.maintenanceStatus ?? room.maintenanceStatus;

  await prisma.room.update({
    where: { id },
    data: { cleaningStatus, maintenanceStatus },
  });
  // Derive the status from live bookings so clearing maintenance restores the
  // correct AVAILABLE / RESERVED / OCCUPIED value.
  const updated = (await syncRoomStatus(id)) ?? (await prisma.room.findUnique({ where: { id } }));

  if (maintenanceStatus === "NEEDS_MAINTENANCE" && room.maintenanceStatus !== "NEEDS_MAINTENANCE") {
    await createNotification({
      type: "MAINTENANCE",
      title: `Room ${room.number} needs maintenance`,
      message: `Room ${room.number} has been flagged for maintenance and needs attention.`,
      link: "/rooms",
    });
  }

  broadcastUpdate("rooms-updated");
  broadcastUpdate("dashboard-updated");

  return NextResponse.json({ room: updated });
}
