import "server-only";
import { readFileSync } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

type Messaging = import("firebase-admin/messaging").Messaging;
type ServiceAccount = import("firebase-admin/app").ServiceAccount;

let messaging: Messaging | null = null;
let messagingInitFailed = false;

/**
 * Loads the Firebase service-account credentials.
 *
 * Serverless hosts have no writable disk and no way to ship a secret file, so
 * the JSON is read from an environment variable first. Reading a file is kept
 * as a fallback for local development, where FIREBASE_SERVICE_ACCOUNT_PATH is
 * convenient.
 *
 * FIREBASE_SERVICE_ACCOUNT_JSON accepts either the raw JSON or a base64-encoded
 * copy of it — pasting multi-line JSON into a dashboard field often mangles the
 * newlines inside `private_key`, and base64 sidesteps that entirely.
 */
function loadServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    const text = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf-8");
    const parsed = JSON.parse(text);
    // A private key pasted through a web form usually arrives with literal
    // "\n" sequences rather than real newlines; restore them.
    if (typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed as ServiceAccount;
  }

  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (filePath) {
    return JSON.parse(
      readFileSync(path.resolve(process.cwd(), filePath), "utf-8"),
    ) as ServiceAccount;
  }

  return null;
}

async function getMessaging(): Promise<Messaging | null> {
  if (messaging) return messaging;
  // Don't retry on every notification once we know Firebase isn't configured.
  if (messagingInitFailed) return null;

  try {
    const serviceAccount = loadServiceAccount();
    if (!serviceAccount) {
      messagingInitFailed = true;
      return null;
    }

    const { initializeApp, getApps, cert } = await import("firebase-admin/app");
    const { getMessaging: _getMessaging } = await import("firebase-admin/messaging");

    const app = getApps().length
      ? getApps()[0]
      : initializeApp({ credential: cert(serviceAccount) });

    messaging = _getMessaging(app);
    return messaging;
  } catch (err) {
    messagingInitFailed = true;
    // Surface the reason once — a malformed key is otherwise invisible.
    console.error(
      "[push] Firebase Admin could not start, push notifications are disabled:",
      err instanceof Error ? err.message : err,
    );
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

  // Clicking the notification should open the app, so send an absolute URL.
  const base = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
  const link = payload.link
    ? base
      ? `${base}${payload.link}`
      : payload.link
    : base || undefined;

  const response = await m.sendEachForMulticast({
    tokens,
    notification: { title: payload.title, body: payload.body },
    webpush: {
      notification: { icon: "/icon-192.png", badge: "/icon-192.png" },
      ...(link ? { fcmOptions: { link } } : {}),
    },
    android: {
      priority: "high",
      notification: { sound: "default", channelId: "hotel_notifications" },
    },
    apns: { payload: { aps: { sound: "default" } } },
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

  if (response.failureCount > 0) {
    const reasons = response.responses
      .filter((r) => !r.success)
      .map((r) => r.error?.code ?? "unknown");
    console.error(
      `[push] ${response.failureCount}/${tokens.length} sends failed:`,
      [...new Set(reasons)].join(", "),
    );
  }
}
