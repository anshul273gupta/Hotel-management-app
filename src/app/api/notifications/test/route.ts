import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createNotification } from "@/lib/notifications";

/**
 * Sends a test notification to every registered device.
 *
 * Useful for confirming push works end to end without having to check a real
 * guest in and out.
 */
export async function POST() {
  const session = await getSession();
  if (!session || (session.role !== "OWNER" && session.role !== "MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  await createNotification({
    type: "CHECK_IN",
    title: "Test notification",
    message: `Sent by ${session.name} at ${new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    })}. If you can see this on your phone, push notifications are working.`,
    link: "/",
  });

  return NextResponse.json({
    sent: true,
    note: "Check the in-app bell and your phone. If the bell shows it but the phone doesn't buzz, push is the part that needs attention.",
  });
}
