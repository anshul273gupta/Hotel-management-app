import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Devices currently signed in, for the owner's Devices page.
 *
 * Owner-only: this reveals when and from where staff signed in, and drives the
 * ability to sign them out.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Only the owner can view signed-in devices" }, { status: 403 });
  }

  const now = new Date();
  const sessions = await prisma.userSession.findMany({
    where: { revokedAt: null, expiresAt: { gt: now } },
    include: { user: { select: { id: true, name: true, username: true, role: true } } },
    orderBy: { lastSeenAt: "desc" },
  });

  return NextResponse.json({
    // The caller needs to know which row is the device they're using, so the
    // page can label it and refuse to sign it out by accident.
    currentSessionId: session.sessionId ?? null,
    devices: sessions.map((s) => ({
      id: s.id,
      device: s.device ?? "Unknown device",
      ipAddress: s.ipAddress,
      signedInAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      expiresAt: s.expiresAt,
      isCurrent: s.id === session.sessionId,
      user: {
        id: s.user.id,
        name: s.user.name,
        username: s.user.username,
        role: s.user.role,
      },
    })),
  });
}
