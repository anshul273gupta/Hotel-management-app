import { NextRequest, NextResponse } from "next/server";
import { registerTokenToCloud } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    await registerTokenToCloud(token);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to register token" }, { status: 500 });
  }
}
