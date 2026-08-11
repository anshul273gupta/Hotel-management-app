import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_DURATION_SECONDS,
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Turns a browser user-agent into something recognisable in the device list.
 *
 * Deliberately rough: the aim is for the owner to tell "my phone" from "the
 * reception computer", not to fingerprint anything.
 */
export function describeDevice(userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  if (!ua) return "Unknown device";

  // The Android wrapper is a WebView, so it must be checked before Chrome.
  const isApp = /\bwv\b/i.test(ua) || ua.includes("AgrawalInn");

  let os = "Unknown";
  if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iPhone/iPad";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "Mac";
  else if (/Linux/i.test(ua)) os = "Linux";

  if (isApp && os === "Android") return "Agrawal Inn app (Android)";

  let browser = "";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua)) browser = "Safari";

  return browser ? `${browser} on ${os}` : os;
}

/**
 * Records the sign-in and issues a token tied to that row, so the device can
 * be signed out later.
 */
export async function createSession(
  payload: Omit<SessionPayload, "sessionId">,
  meta?: { userAgent?: string | null; ipAddress?: string | null },
) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);

  const record = await prisma.userSession.create({
    data: {
      userId: payload.userId,
      device: describeDevice(meta?.userAgent),
      ipAddress: meta?.ipAddress ?? null,
      expiresAt,
    },
  });

  const token = await signSessionToken({ ...payload, sessionId: record.id });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();

  // Mark the row revoked too, otherwise the device would linger in the
  // owner's list long after the person signed themselves out.
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const payload = await verifySessionToken(token);
    if (payload?.sessionId) {
      await prisma.userSession
        .updateMany({
          where: { id: payload.sessionId, revokedAt: null },
          data: { revokedAt: new Date() },
        })
        .catch(() => {
          // The cookie is cleared below regardless; a database hiccup must not
          // leave someone unable to sign out.
        });
    }
  }

  /**
   * Overwrite the cookie with an already-expired one rather than calling
   * `delete()`.
   *
   * `delete()` emits a bare `hotel_session=; Expires=1970...` with none of the
   * attributes the cookie was created with. A browser only replaces a stored
   * cookie when the name, path AND security attributes all match, so the
   * bare version was treated as a *different* cookie: the real session
   * survived and the next launch signed the user straight back in. Android's
   * WebView is especially strict here, which is why the app kept doing it.
   *
   * These options must stay identical to createSession above.
   */
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

/**
 * The signed-in user, or null.
 *
 * A valid signature is no longer enough: if the token names a session row,
 * that row must still be live. This is what makes "sign this device out"
 * actually take effect rather than waiting for the token to expire.
 *
 * Cached per request, so the extra lookup runs once however many times a page
 * asks who is signed in.
 */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  // Tokens issued before session tracking existed have no id. They stay valid
  // until they lapse rather than signing everyone out on deploy.
  if (!payload.sessionId) return payload;

  const record = await prisma.userSession.findUnique({
    where: { id: payload.sessionId },
    select: { revokedAt: true, expiresAt: true },
  });

  if (!record || record.revokedAt || record.expiresAt <= new Date()) return null;

  return payload;
});

/**
 * Notes that a session is still in use, so the owner can see which devices are
 * active. Throttled to once every 5 minutes — every page view would otherwise
 * be a database write.
 */
export async function touchSession(sessionId: string) {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000);
  await prisma.userSession
    .updateMany({
      where: { id: sessionId, revokedAt: null, lastSeenAt: { lt: cutoff } },
      data: { lastSeenAt: new Date() },
    })
    .catch(() => {
      // Purely informational; never block a request over it.
    });
}

export type { SessionPayload };
