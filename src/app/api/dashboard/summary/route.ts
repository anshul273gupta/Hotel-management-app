import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getDashboardSummary } from "@/lib/dashboard";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await getDashboardSummary();
  return NextResponse.json(summary);
}
