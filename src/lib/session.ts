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

export async function createSession(payload: SessionPayload) {
  const token = await signSessionToken(payload);
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

export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
});

export type { SessionPayload };
