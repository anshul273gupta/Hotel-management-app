import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveUploadedFile } from "@/lib/storage";
import { createNotification, broadcastUpdate } from "@/lib/notifications";
import { SERVICE_REQUEST_TYPE_LABELS } from "@/lib/constants";
import type { ServiceRequestType } from "@/lib/types";

const REQUEST_TYPES = Object.keys(SERVICE_REQUEST_TYPE_LABELS) as ServiceRequestType[];

export async function POST(request: Request) {
  const formData = await request.formData();

  const roomToken = formData.get("roomToken");
  const type = formData.get("type");
  const description = formData.get("description");
  const photo = formData.get("photo");

  if (typeof roomToken !== "string" || !roomToken) {
    return NextResponse.json({ error: "Missing room token" }, { status: 400 });
  }
  if (typeof type !== "string" || !REQUEST_TYPES.includes(type as ServiceRequestType)) {
    return NextResponse.json({ error: "Invalid request type" }, { status: 400 });
  }
  if (type === "CUSTOM" && (typeof description !== "string" || !description.trim())) {
    return NextResponse.json({ error: "Description is required for custom requests" }, { status: 400 });
  }

  const room = await prisma.room.findUnique({
    where: { qrToken: roomToken },
    include: { bookings: { where: { status: "CHECKED_IN" }, take: 1 } },
  });
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  if (room.bookings.length === 0) {
    return NextResponse.json({ error: "This room is not currently occupied" }, { status: 403 });
  }

  let photoUrl: string | undefined;
  if (photo instanceof File && photo.size > 0) {
    try {
      photoUrl = await saveUploadedFile(photo, "service-requests");
    } catch (err) {
      const e = err as { message?: string; status?: number };
      return NextResponse.json(
        { error: e?.message ?? "Could not upload the photo" },
        { status: e?.status ?? 400 },
      );
    }
  }

  const serviceRequest = await prisma.serviceRequest.create({
    data: {
      roomId: room.id,
      type: type as ServiceRequestType,
      description: typeof description === "string" && description.trim() ? description.trim() : undefined,
      photoUrl,
    },
  });

  await createNotification({
    type: "SERVICE_REQUEST",
    title: "New Service Request",
    message: `Room ${room.number} requested: ${SERVICE_REQUEST_TYPE_LABELS[type as ServiceRequestType]}`,
    link: "/requests",
  });
  broadcastUpdate("requests-updated");

  return NextResponse.json({ request: serviceRequest });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomToken = searchParams.get("roomToken");

  if (!roomToken) {
    return NextResponse.json({ error: "Missing room token" }, { status: 400 });
  }

  const room = await prisma.room.findUnique({
    where: { qrToken: roomToken },
    include: {
      bookings: {
        where: { status: "CHECKED_IN" },
        orderBy: { checkInDate: "desc" },
        take: 1,
        select: { checkInDate: true },
      },
    },
  });
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  // Only expose requests raised during the current stay — otherwise the next
  // occupant of the room can read the previous guest's request history.
  const currentStayStart = room.bookings[0]?.checkInDate;
  if (!currentStayStart) {
    return NextResponse.json({ requests: [] });
  }

  const requests = await prisma.serviceRequest.findMany({
    where: { roomId: room.id, createdAt: { gte: currentStayStart } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      type: true,
      description: true,
      status: true,
      rating: true,
      ratingComment: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ requests });
}
