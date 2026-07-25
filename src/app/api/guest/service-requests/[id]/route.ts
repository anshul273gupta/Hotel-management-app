import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createNotification, broadcastUpdate } from "@/lib/notifications";
import { SERVICE_REQUEST_TYPE_LABELS } from "@/lib/constants";
import type { ServiceRequestType } from "@/lib/types";

const schema = z.object({
  // Proves the rater is the guest in that room. Without it any visitor could
  // rate (and spam notifications for) arbitrary request IDs.
  roomToken: z.string().min(1, "Missing room token"),
  rating: z.coerce.number().int().min(1).max(5),
  ratingComment: z.string().max(500).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await prisma.serviceRequest.findUnique({ where: { id }, include: { room: true } });
  if (!existing) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (existing.room.qrToken !== parsed.data.roomToken) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (existing.status !== "COMPLETED") {
    return NextResponse.json({ error: "Request is not completed yet" }, { status: 400 });
  }
  if (existing.rating !== null) {
    return NextResponse.json({ error: "Request already rated" }, { status: 400 });
  }

  const updated = await prisma.serviceRequest.update({
    where: { id },
    data: { rating: parsed.data.rating, ratingComment: parsed.data.ratingComment || undefined },
  });

  await createNotification({
    type: "SERVICE_REQUEST",
    title: "Guest Rating Received",
    message: `Room ${existing.room.number} rated their ${SERVICE_REQUEST_TYPE_LABELS[existing.type as ServiceRequestType]} request ${parsed.data.rating}★${
      parsed.data.ratingComment ? ` — "${parsed.data.ratingComment}"` : ""
    }`,
    link: "/requests",
  });
  broadcastUpdate("requests-updated");

  return NextResponse.json({ request: updated });
}
