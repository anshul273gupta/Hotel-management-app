import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { processAutomaticBookingTransitions } from "@/lib/booking-automation";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processAutomaticBookingTransitions();
  return NextResponse.json(result);
}
