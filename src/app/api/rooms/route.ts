import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getRoomsWithCurrentBooking } from "@/lib/rooms";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rooms = await getRoomsWithCurrentBooking();
  return NextResponse.json({ rooms });
}
