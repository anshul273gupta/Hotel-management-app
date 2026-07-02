import { networkInterfaces } from "os";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { QrCodeGrid } from "@/components/qr-codes/qr-code-grid";

export const dynamic = "force-dynamic";

const VIRTUAL_ADAPTER_PATTERN = /vmware|virtualbox|vethernet|hyper-v|docker|wsl|loopback/i;

function getLanBaseUrl(): string {
  // 1. Live tunnel file written by start-hotel.js (https:// URL — any network)
  try {
    const tunnelFile = join(process.cwd(), ".tunnel-url");
    if (existsSync(tunnelFile)) {
      const tunnelUrl = readFileSync(tunnelFile, "utf8").trim();
      if (tunnelUrl.startsWith("https://")) return tunnelUrl;
    }
  } catch {}

  // 2. APP_BASE_URL only when it's a tunnel/ngrok URL (https://)
  //    Ignore plain http:// LAN IPs — they go stale when the laptop's IP changes
  const explicit = process.env.APP_BASE_URL;
  if (explicit?.startsWith("https://")) return explicit;

  // 3. Auto-detect current LAN IP (always accurate, works on same WiFi)
  const port = process.env.PORT ?? "3000";
  const nets = networkInterfaces();
  let fallbackIp: string | null = null;

  for (const [name, addrs] of Object.entries(nets)) {
    for (const addr of addrs ?? []) {
      if (addr.family !== "IPv4" || addr.internal) continue;
      if (VIRTUAL_ADAPTER_PATTERN.test(name)) {
        fallbackIp ??= addr.address;
        continue;
      }
      return `http://${addr.address}:${port}`;
    }
  }

  if (fallbackIp) return `http://${fallbackIp}:${port}`;
  return `http://localhost:${port}`;
}

export default async function QrCodesPage() {
  const rooms = await prisma.room.findMany({
    orderBy: [{ floor: "asc" }, { number: "asc" }],
    select: { id: true, number: true, floor: true, qrToken: true },
  });

  const baseUrl = getLanBaseUrl();

  const roomsWithQr = await Promise.all(
    rooms.map(async (room) => {
      const url = `${baseUrl}/guest/${room.qrToken}`;
      const qrDataUrl = await QRCode.toDataURL(url, { width: 280, margin: 1 });
      return {
        id: room.id,
        number: room.number,
        floor: room.floor,
        url,
        qrDataUrl,
      };
    }),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            QR Codes
          </h1>
          <p className="text-sm text-muted-foreground">
            Each room&apos;s QR code opens a guest self-service page for housekeeping, amenities, and more.
          </p>
        </div>
      </div>
      <QrCodeGrid rooms={roomsWithQr} />
    </div>
  );
}
