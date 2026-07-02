import "server-only";
import { prisma } from "@/lib/prisma";
import { emitRealtimeEvent, type RealtimeEvent } from "@/lib/events";
import { pushNotificationToCloud } from "@/lib/firebase-admin";
import type { NotificationType, Role } from "@/lib/types";

type CreateNotificationInput = {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  targetRole?: Role | null;
};

/** Persists a notification and pushes it to connected clients via SSE. */
export async function createNotification(input: CreateNotificationInput) {
  const notification = await prisma.notification.create({
    data: {
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link,
      targetRole: input.targetRole ?? null,
    },
  });

  emitRealtimeEvent({ kind: "notification", data: notification });

  // Push to Firestore — Firebase Cloud Function sends FCM even when laptop is off
  pushNotificationToCloud({
    title: input.title,
    body: input.message,
    link: input.link,
  }).catch(() => {});

  return notification;
}

/** Broadcasts a lightweight "data changed" signal so pages can refetch. */
export function broadcastUpdate(kind: RealtimeEvent["kind"]) {
  emitRealtimeEvent({ kind } as RealtimeEvent);
}
