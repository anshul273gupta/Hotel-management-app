import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getApp() {
  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
}

/**
 * Registers this browser for push notifications and stores the token server-side.
 *
 * Returns a short reason string when registration can't proceed, so callers (and
 * anyone reading the console) can tell a misconfiguration apart from a user who
 * simply declined. Push is optional — the in-app bell works regardless.
 */
export async function registerPushToken(): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    return fail("NEXT_PUBLIC_FIREBASE_VAPID_KEY is not set");
  }
  if (!firebaseConfig.projectId) {
    return fail("NEXT_PUBLIC_FIREBASE_* variables are not set");
  }
  if (typeof window === "undefined" || !("Notification" in window)) {
    return fail("this browser has no Notification API");
  }
  if (!("serviceWorker" in navigator)) {
    return fail("this browser has no service worker support");
  }
  // iOS only allows web push once the site is installed to the home screen.
  if (
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !("standalone" in navigator && (navigator as { standalone?: boolean }).standalone)
  ) {
    return fail("on iPhone, add the site to your Home Screen first");
  }

  try {
    const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    // getToken can race the worker's activation on a cold first load.
    await navigator.serviceWorker.ready;

    const messaging = getMessaging(getApp());
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: reg });
    if (!token) return fail("Firebase returned no token");

    const res = await fetch("/api/notifications/fcm-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return fail(`server rejected the token (HTTP ${res.status})`);

    return { ok: true };
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}

function fail(reason: string): { ok: false; reason: string } {
  console.warn(`[push] not enabled: ${reason}`);
  return { ok: false, reason };
}
