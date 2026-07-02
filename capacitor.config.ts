import type { CapacitorConfig } from '@capacitor/cli';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { networkInterfaces } from 'os';

// At sync time: prefer tunnel URL, fall back to current LAN IP
function getServerUrl(): string {
  // 1. Live tunnel URL written by start-hotel.js
  try {
    const tunnelFile = join(__dirname, '.tunnel-url');
    if (existsSync(tunnelFile)) {
      const url = readFileSync(tunnelFile, 'utf-8').trim();
      // Only accept real tunnel URLs — not localhost.run's own admin portal
      const isTunnel = /https:\/\/[a-z0-9-]+\.(localhost\.run|serveo\.net|ngrok\.io|ngrok-free\.app|loca\.lt)/.test(url);
      if (isTunnel) return url;
    }
  } catch {}

  // 2. Auto-detect current Wi-Fi IP
  const SKIP = /vmware|virtualbox|vethernet|hyper-v|docker|wsl|loopback/i;
  const nets = networkInterfaces();
  for (const [name, addrs] of Object.entries(nets)) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal && !SKIP.test(name))
        return `http://${a.address}:3000`;
    }
  }

  return 'http://192.168.29.10:3000';
}

const serverUrl = getServerUrl();
console.log(`[Capacitor] server.url → ${serverUrl}`);

const config: CapacitorConfig = {
  appId: 'com.AgrawalInn.hotelmanagement',
  appName: 'Hotel Agrawal Inn',
  webDir: 'out',
  server: {
    url: serverUrl,
    cleartext: !serverUrl.startsWith('https'),
  },
};

export default config;
