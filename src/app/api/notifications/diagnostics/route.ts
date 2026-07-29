import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/**
 * Reports whether push notifications are correctly configured.
 *
 * Push has a lot of moving parts — seven browser-side Firebase values, a
 * server credential, a reachable service worker and at least one registered
 * device. When it silently does nothing there's no way to tell which piece is
 * missing, so this endpoint checks each one.
 *
 * Only presence is reported, never the values themselves.
 */
export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== "OWNER" && session.role !== "MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const browserVars = {
    NEXT_PUBLIC_FIREBASE_API_KEY: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_VAPID_KEY: !!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
  };

  // Check the server credential parses, without leaking any of it.
  let serverCredential: string;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    serverCredential = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
      ? "using file path (will not work on Vercel)"
      : "missing";
  } else {
    try {
      const text = raw.trim().startsWith("{")
        ? raw
        : Buffer.from(raw, "base64").toString("utf-8");
      const parsed = JSON.parse(text);
      serverCredential =
        parsed.project_id && parsed.private_key && parsed.client_email
          ? `ok (project: ${parsed.project_id})`
          : "malformed — missing project_id, client_email or private_key";
    } catch {
      serverCredential = "unreadable — not valid JSON or base64";
    }
  }

  const registeredDevices = await prisma.deviceToken.count();

  const missingBrowserVars = Object.entries(browserVars)
    .filter(([, present]) => !present)
    .map(([name]) => name);

  const ready =
    missingBrowserVars.length === 0 &&
    serverCredential.startsWith("ok") &&
    registeredDevices > 0;

  return NextResponse.json({
    ready,
    browserConfig: missingBrowserVars.length ? { missing: missingBrowserVars } : "all present",
    serverCredential,
    registeredDevices,
    appBaseUrl: process.env.APP_BASE_URL ?? "(not set — notification taps may not open the app)",
    nextStep: ready
      ? "Configuration looks complete. Check a guest in to test."
      : registeredDevices === 0 && missingBrowserVars.length === 0 && serverCredential.startsWith("ok")
        ? "Config is fine but no device has registered yet. Open the app on a phone, log in, and tap Allow when asked about notifications."
        : "Fix the items reported above, then redeploy.",
  });
}
