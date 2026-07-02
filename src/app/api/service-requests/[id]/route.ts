import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { broadcastUpdate } from "@/lib/notifications";

const schema = z.object({
  status: z.enum(["PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED"]).optional(),
  assignedToId: z.string().nullable().optional(),
  notes: z.string().optional(),
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
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await prisma.serviceRequest.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const data: {
    status?: typeof existing.status;
    assignedToId?: string | null;
    notes?: string;
    assignedAt?: Date;
    completedAt?: Date | null;
  } = {};

  if (parsed.data.assignedToId !== undefined) {
    data.assignedToId = parsed.data.assignedToId;
    if (parsed.data.assignedToId) data.assignedAt = new Date();
  }

  if (parsed.data.notes !== undefined) {
    data.notes = parsed.data.notes;
  }

  if (parsed.data.status) {
    data.status = parsed.data.status;
    if (parsed.data.status === "COMPLETED") {
      data.completedAt = new Date();
    } else if (existing.status === "COMPLETED") {
      data.completedAt = null;
    }
  }

  const updated = await prisma.serviceRequest.update({
    where: { id },
    data,
    include: {
      room: { select: { number: true, floor: true, type: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  broadcastUpdate("requests-updated");

  return NextResponse.json({ request: updated });
}
