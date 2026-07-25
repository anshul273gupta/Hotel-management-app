import "server-only";
import { readFileSync } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

type Messaging = import("firebase-admin/messaging").Messaging;

let messaging: Messaging | null = null;
let messagingInitFailed = false;

async function getMessaging(): Promise<Messaging | null> {
  if (messaging) return messaging;
  // Don't retry (and re-read the key file) on every notification once we know
  // Firebase isn't configured on this deployment.
  if (messagingInitFailed) return null;

  try {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (!serviceAccountPath) {
      messagingInitFailed = true;
      return null;
    }

    const { initializeApp, getApps, cert } = await import("firebase-admin/app");
    const { getMessaging: _getMessaging } = await import("firebase-admin/messaging");

    const serviceAccount = JSON.parse(
      readFileSync(path.resolve(process.cwd(), serviceAccountPath), "utf-8"),
    );

    const app = getApps().length
      ? getApps()[0]
      : initializeApp({ credential: cert(serviceAccount) });

    messaging = _getMessaging(app);
    return messaging;
  } catch {
    messagingInitFailed = true;
    return null;
  }
}

export async function registerTokenToCloud(token: string) {
  await prisma.deviceToken.upsert({
    where: { token },
    update: { updatedAt: new Date() },
    create: { token },
  });
}

export async function pushNotificationToCloud(payload: {
  title: string;
  body: string;
  link?: string;
}) {
  const m = await getMessaging();
  if (!m) return;

  const rows = await prisma.deviceToken.findMany({ select: { token: true } });
  if (!rows.length) return;

  const tokens = rows.map((r) => r.token);

  const response = await m.sendEachForMulticast({
    tokens,
    notification: { title: payload.title, body: payload.body },
    webpush: {
      notification: { icon: "/icon-192.png" },
      ...(payload.link ? { fcmOptions: { link: payload.link } } : {}),
    },
  });

  // Remove stale / invalid tokens so future sends stay clean
  const invalid: string[] = [];
  response.responses.forEach((r, i) => {
    if (
      !r.success &&
      (r.error?.code === "messaging/invalid-registration-token" ||
        r.error?.code === "messaging/registration-token-not-registered")
    ) {
      invalid.push(tokens[i]);
    }
  });

  if (invalid.length) {
    await prisma.deviceToken.deleteMany({ where: { token: { in: invalid } } });
  }
}
