import { prisma } from "@/lib/prisma";

export async function getServiceRequests() {
  return prisma.serviceRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      room: { select: { number: true, floor: true, type: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });
}

export type ServiceRequestWithRelations = Awaited<ReturnType<typeof getServiceRequests>>[number];
