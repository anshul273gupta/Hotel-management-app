import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const TUNNEL_URL_FILE = join(process.cwd(), ".tunnel-url");
const ENV_PATH = join(process.cwd(), ".env");

export async function GET() {
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
  const body = await request.json();
  const url: string = (body.url ?? "").trim().replace(/\/$/, "");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Write to .tunnel-url (read by QR page on every load)
  writeFileSync(TUNNEL_URL_FILE, url, "utf8");

  // Also persist to .env and process.env as backup
  let content = readFileSync(ENV_PATH, "utf8");
  const regex = /^APP_BASE_URL=.*$/m;
  const newLine = `APP_BASE_URL="${url}"`;
  content = regex.test(content) ? content.replace(regex, newLine) : content + `\n${newLine}\n`;
  writeFileSync(ENV_PATH, content);
  process.env.APP_BASE_URL = url;

  return NextResponse.json({ success: true, url });
}
