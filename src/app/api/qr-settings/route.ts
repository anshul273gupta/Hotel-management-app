import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { getSession } from "@/lib/session";

const TUNNEL_URL_FILE = join(process.cwd(), ".tunnel-url");
const ENV_PATH = join(process.cwd(), ".env");

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Read live tunnel file first, then env var
  try {
    if (existsSync(TUNNEL_URL_FILE)) {
      const tunnelUrl = readFileSync(TUNNEL_URL_FILE, "utf8").trim();
      if (tunnelUrl) return NextResponse.json({ url: tunnelUrl });
    }
  } catch {}
  return NextResponse.json({ url: process.env.APP_BASE_URL ?? "" });
}

export async function POST(request: Request) {
  // Anyone who can set this URL controls where every room QR code points, so
  // restrict it to managers and owners. It used to be completely unauthenticated.
  const session = await getSession();
  if (!session || (session.role !== "OWNER" && session.role !== "MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const url: string = (body?.url ?? "").trim().replace(/\/$/, "");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return NextResponse.json({ error: "URL must start with http:// or https://" }, { status: 400 });
  }

  try {
    // Write to .tunnel-url (read by QR page on every load)
    writeFileSync(TUNNEL_URL_FILE, url, "utf8");

    // Also persist to .env and process.env as backup. On a read-only or
    // serverless filesystem (Vercel) this throws — the tunnel URL simply
    // isn't persistable there, so report it instead of returning a 500.
    let content = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
    const regex = /^APP_BASE_URL=.*$/m;
    const newLine = `APP_BASE_URL="${url}"`;
    content = regex.test(content) ? content.replace(regex, newLine) : `${content}\n${newLine}\n`;
    writeFileSync(ENV_PATH, content);
  } catch {
    return NextResponse.json(
      { error: "Could not save the URL on this server (read-only filesystem). Set APP_BASE_URL in your environment instead." },
      { status: 500 },
    );
  }

  process.env.APP_BASE_URL = url;

  return NextResponse.json({ success: true, url });
}
