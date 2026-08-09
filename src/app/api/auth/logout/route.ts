import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

// Signing out must always reach the server — never a cached response.
export const dynamic = "force-dynamic";

export async function POST() {
  await destroySession();
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
