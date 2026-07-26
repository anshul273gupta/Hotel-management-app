import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { processAutomaticBookingTransitions } from "@/lib/booking-automation";

/**
 * Runs the automatic booking transitions (auto check-out of stays past their
 * expected checkout, plus payment reminders).
 *
 * Two callers are allowed:
 *
 *  1. A signed-in user — the dashboard pings this every minute while open.
 *  2. Vercel Cron — so the transitions still happen overnight when nobody has
 *     the app open. Vercel sends `Authorization: Bearer $CRON_SECRET`, and we
 *     only trust that header when CRON_SECRET is actually configured.
 *
 * GET exists because Vercel Cron issues GET requests; POST is kept for the
 * in-app poller.
 */
async function isAuthorised(request: Request): Promise<boolean> {
  const session = await getSession();
  if (session) return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

async function run(request: Request) {
  if (!(await isAuthorised(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processAutomaticBookingTransitions();
  return NextResponse.json({ ...result, at: new Date().toISOString() });
}

export async function POST(request: Request) {
  return run(request);
}

export async function GET(request: Request) {
  return run(request);
}
