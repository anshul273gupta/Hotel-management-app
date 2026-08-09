import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * A tiny "has anything changed?" endpoint.
 *
 * Live updates used to work by holding a Server-Sent Events stream open. That
 * cannot work on Vercel: every request is a short-lived serverless function, so
 * the stream is closed the moment it opens. The browser then reconnected every
 * 3 seconds, forever, and a separate timer re-rendered every page from the
 * server every 20 seconds whether or not anything had actually changed. On a
 * phone that meant constant network traffic and a UI that always felt busy.
 *
 * Instead the app now asks this endpoint for a small stamp. It is a handful of
 * indexed aggregate queries returning a few dozen bytes, and the client only
 * re-renders when the stamp actually differs from last time.
 */
export async function GET() {
  const [rooms, bookings, requests, notifications] = await Promise.all([
    prisma.room.aggregate({ _max: { updatedAt: true }, _count: true }),
    prisma.booking.aggregate({ _max: { updatedAt: true }, _count: true }),
    prisma.serviceRequest.aggregate({ _max: { updatedAt: true }, _count: true }),
    prisma.notification.aggregate({ _max: { createdAt: true }, _count: true }),
  ]);

  const stamp = (date: Date | null | undefined, count: number) =>
    `${date ? date.getTime() : 0}:${count}`;

  return NextResponse.json(
    {
      rooms: stamp(rooms._max.updatedAt, rooms._count),
      bookings: stamp(bookings._max.updatedAt, bookings._count),
      requests: stamp(requests._max.updatedAt, requests._count),
      notifications: stamp(notifications._max.createdAt, notifications._count),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
