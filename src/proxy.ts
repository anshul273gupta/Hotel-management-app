import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname === path)) {
    return NextResponse.next();
  }

  // Vercel Cron calls the automation endpoint with a bearer token instead of a
  // session cookie. Let those through so scheduled check-outs still run when
  // nobody has the dashboard open; the route re-checks the secret itself.
  const cronSecret = process.env.CRON_SECRET;
  if (
    cronSecret &&
    pathname === "/api/bookings/auto-process" &&
    request.headers.get("authorization") === `Bearer ${cronSecret}`
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/owner") && session.role !== "OWNER") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Protect everything except: login page, guest-facing QR pages and APIs,
     * auth API, uploaded files, and Next.js internals.
     *
     * The alternatives are anchored with a trailing `/` or end-of-string so a
     * prefix match can't be abused: without it, `/guests` and
     * `/api/guests/lookup` matched the `guest` exclusion and skipped auth
     * entirely, exposing the whole guest register.
     */
    "/((?!login$|guest/|api/auth/|api/guest/|_next/static/|_next/image|uploads/|favicon.ico$|logo.jpeg$).*)",
  ],
};
