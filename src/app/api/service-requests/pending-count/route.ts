import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await prisma.serviceRequest.count({
    where: { status: { in: ["PENDING", "ASSIGNED"] } },
  });

  return NextResponse.json({ count });
}
