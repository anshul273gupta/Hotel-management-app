import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { broadcastUpdate } from "@/lib/notifications";

/**
 * Signs a single device out.
 *
 * The session row is marked revoked, and getSession() rejects any token
 * pointing at a revoked row — so the device is locked out on its very next
 * request rather than whenever its token happens to expire.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Only the owner can sign out devices" }, { status: 403 });
  }

  const { id } = await params;

  const target = await prisma.userSession.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, role: true } } },
  });
  if (!target) {
    return NextResponse.json({ error: "That device is no longer signed in" }, { status: 404 });
  }
  if (target.revokedAt) {
    return NextResponse.json({ error: "That device is already signed out" }, { status: 409 });
  }

  // The owner may sign out staff, and their own other devices — but not
  // another owner, so two owners can't lock each other out of the hotel.
  const isOwnDevice = target.userId === session.userId;
  if (!isOwnDevice && target.user.role === "OWNER") {
    return NextResponse.json(
      { error: "Another owner's device cannot be signed out from here" },
      { status: 403 },
    );
  }

  // Signing out the device you're using would drop you straight to the login
  // screen mid-task; the Log out menu is the intended route for that.
  if (session.sessionId && target.id === session.sessionId) {
    return NextResponse.json(
      { error: "This is the device you are using — use Log out instead" },
      { status: 409 },
    );
  }

  await prisma.userSession.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  broadcastUpdate("dashboard-updated");

  return NextResponse.json({
    ok: true,
    signedOut: { id: target.id, name: target.user.name, device: target.device },
  });
}
