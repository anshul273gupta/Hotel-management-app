import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAvailableRoomsForRange } from "@/lib/rooms";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const checkInParam = searchParams.get("checkIn");
  const checkOutParam = searchParams.get("checkOut");

  const checkIn = checkInParam ? new Date(checkInParam) : null;
  const checkOut = checkOutParam ? new Date(checkOutParam) : null;

  if (!checkIn || !checkOut || Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
    return NextResponse.json({ error: "Invalid checkIn or checkOut date" }, { status: 400 });
  }
  if (checkOut <= checkIn) {
    return NextResponse.json({ error: "checkOut must be after checkIn" }, { status: 400 });
  }

  const rooms = await getAvailableRoomsForRange(checkIn, checkOut);
  return NextResponse.json({ rooms });
}
