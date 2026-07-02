#!/usr/bin/env node
/**
 * Hotel Agrawal Inn - One-click startup script
 * Run with: node start-hotel.js
 */

const { spawn, execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ENV_PATH = path.join(__dirname, ".env");
const TUNNEL_URL_FILE = path.join(__dirname, ".tunnel-url");
const PORT = 3000;
let nextProcess = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadEnv() {
  try {
    const lines = fs.readFileSync(ENV_PATH, "utf8").split("\n");
    const env = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^"(.*)"$/, "$1");
      env[key] = val;
    }
    return env;
  } catch {
    return {};
  }
}

function updateEnvVar(key, value) {
  let content = fs.readFileSync(ENV_PATH, "utf8");
  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(content)) {
    content = content.replace(regex, `${key}="${value}"`);
  } else {
    content += `\n${key}="${value}"\n`;
  }
  fs.writeFileSync(ENV_PATH, content);
  process.env[key] = value;
}

function setTunnelUrl(url) {
  fs.writeFileSync(TUNNEL_URL_FILE, url, "utf8");
  updateEnvVar("APP_BASE_URL", url);
}

function clearTunnelUrl() {
  try { fs.unlinkSync(TUNNEL_URL_FILE); } catch {}
}

function startNextJs() {
  if (nextProcess) return;

  const nextDir = path.join(__dirname, ".next");
  if (!fs.existsSync(nextDir)) {
    console.log("\n  Building app (first run — takes ~30s)...\n");
    try {
      execSync("npm run build", { stdio: "inherit", cwd: __dirname, shell: true });
    } catch {
      console.error("  Build failed. Please check the error above.");
      process.exit(1);
    }
  }

  function launchServer() {
    console.log("\n  Starting Hotel Agrawal Inn on http://localhost:" + PORT + "...\n");
    nextProcess = spawn("npm", ["run", "start", "--", "--port", String(PORT)], {
      stdio: "inherit",
      shell: true,
      cwd: __dirname,
    });

    // Open browser once on first launch
    if (!launchServer._opened) {
      launchServer._opened = true;
      setTimeout(() => {
        const open = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
        spawn(open, ["http://localhost:" + PORT], { shell: true, stdio: "ignore" });
      }, 2500);
    }

    nextProcess.on("close", (code) => {
      nextProcess = null;
      if (code === 0 || code === null) {
        console.log("\n  Server stopped normally.");
        process.exit(0);
      }
      console.log("\n  ⚠️  Server crashed (code " + code + ") — restarting in 3 s...");
      setTimeout(launchServer, 3000);
    });
  }

  launchServer();
}

function isNgrokInstalled() {
  try {
    return spawnSync("ngrok", ["version"], { shell: true, encoding: "utf8" }).status === 0;
  } catch {
    return false;
  }
}

// ─── SSH tunnel — tries port 443 first (bypasses ISP port-22 blocks), then 22 ──

const SSH_SERVICES = [
  // localhost.run on port 443 — works even when ISP blocks port 22
  { host: "localhost.run", port: 443, user: "nokey", urlPattern: /https:\/\/[a-z0-9-]+\.localhost\.run/ },
  // localhost.run on port 22 — fallback
  { host: "localhost.run", port: 22,  user: "nokey", urlPattern: /https:\/\/[a-z0-9-]+\.localhost\.run/ },
  // serveo.net on port 443 — second service fallback
  { host: "serveo.net",    port: 443, user: "nokey", urlPattern: /https:\/\/[a-z0-9]+\.serveo\.net/ },
];

function startSshTunnel(serviceIndex = 0) {
  const svc = SSH_SERVICES[serviceIndex % SSH_SERVICES.length];
  console.log(`  Starting tunnel via ${svc.host}:${svc.port}...`);

  let announced = false;

  const ssh = spawn(
    "ssh",
    [
      "-p", String(svc.port),
      "-o", "StrictHostKeyChecking=no",
      "-o", "BatchMode=yes",
      "-o", "ConnectTimeout=15",
      "-o", "ServerAliveInterval=30",
      "-o", "ServerAliveCountMax=3",
      "-R", `80:localhost:${PORT}`,
      `${svc.user}@${svc.host}`,
    ],
    { stdio: ["ignore", "pipe", "pipe"], shell: false }
  );

  function handleOutput(data) {
    const text = data.toString();
    const match = text.match(svc.urlPattern);
    if (match && !announced) {
      announced = true;
      const url = match[0];
      console.log("  ✅ Tunnel ready: " + url);
      console.log("     QR codes now work on ANY network, any WiFi, mobile data.\n");
      setTunnelUrl(url);
      startNextJs();
    }
  }

  ssh.stdout.on("data", handleOutput);
  ssh.stderr.on("data", handleOutput);

  // Safety valve — start server after 12 s even if tunnel URL not captured yet
  setTimeout(() => {
    if (!nextProcess) {
      console.log("  ⚠️  Tunnel taking long — starting server now.");
      console.log("     QR codes will update automatically once tunnel connects.\n");
      startNextJs();
    }
  }, 12000);

  ssh.on("close", () => {
    announced = false;
    // Rotate to next service on each failure
    const next = (serviceIndex + 1) % SSH_SERVICES.length;
    console.log(`  Tunnel disconnected — trying ${SSH_SERVICES[next].host}:${SSH_SERVICES[next].port} in 5 s...`);
    setTimeout(() => startSshTunnel(next), 5000);
  });
}

// ─── ngrok (optional, for a permanent fixed URL) ──────────────────────────────

function startNgrok(authToken, staticDomain) {
  spawnSync("ngrok", ["config", "add-authtoken", authToken], { shell: true, stdio: "ignore" });
  console.log("  Starting ngrok tunnel → https://" + staticDomain + " ...");

  const ngrok = spawn(
    "ngrok",
    ["http", "--domain=" + staticDomain, String(PORT), "--log=stdout", "--log-format=json"],
    { stdio: ["ignore", "pipe", "pipe"], shell: true }
  );

  let tunnelReady = false;

  function checkReady(data) {
    const text = data.toString();
    try {
      for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        const obj = JSON.parse(line);
        if (obj.msg && (obj.msg.includes("started tunnel") || obj.msg.includes("online"))) {
          if (!tunnelReady) {
            tunnelReady = true;
            const url = "https://" + staticDomain;
            console.log("  ✅ Ngrok tunnel ready: " + url);
            console.log("     QR codes will work on ANY network worldwide.\n");
            setTunnelUrl(url);
            startNextJs();
          }
        }
      }
    } catch {}
  }

  ngrok.stdout.on("data", checkReady);
  ngrok.stderr.on("data", checkReady);

  setTimeout(() => {
    if (!tunnelReady) {
      tunnelReady = true;
      const url = "https://" + staticDomain;
      console.log("  ⚠️  Ngrok slow — starting server anyway.\n");
      setTunnelUrl(url);
      startNextJs();
    }
  }, 10000);

  ngrok.on("close", () => {
    console.log("  Ngrok tunnel dropped — reconnecting in 5 s...");
    setTimeout(() => startNgrok(authToken, staticDomain), 5000);
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log("====================================");
console.log("   Hotel Agrawal Inn - Starting     ");
console.log("====================================\n");
console.log("  Manager:  Hotel Agrawal Inn / manager123");
console.log("  Owner:    Hotel Agrawal Inn / AI9406851411\n");

clearTunnelUrl();

const env = loadEnv();
const authToken = env.NGROK_AUTHTOKEN;
const staticDomain = env.NGROK_STATIC_DOMAIN;

if (authToken && staticDomain) {
  if (isNgrokInstalled()) {
    startNgrok(authToken, staticDomain);
  } else {
    console.log("  ⚠️  Ngrok not found — falling back to SSH tunnel.\n");
    startSshTunnel();
  }
} else {
  // Default: localtunnel with fixed subdomain — no account, no download needed
  startLocaltunnel();
}

// ─── localtunnel — fixed subdomain, no account required ───────────────────────

async function startLocaltunnel() {
  const subdomain = "hotelagrawalinn";
  console.log(`  Starting public tunnel (https://${subdomain}.loca.lt)...`);

  async function launch() {
    try {
      const localtunnel = require("localtunnel");
      const tunnel = await localtunnel({ port: PORT, subdomain });
      const url = tunnel.url;
      console.log("  ✅ Tunnel ready: " + url);
      console.log("     QR codes and APK work on ANY network, any WiFi, mobile data.\n");
      setTunnelUrl(url);
      startNextJs();

      tunnel.on("close", () => {
        console.log("  Tunnel closed — reconnecting in 5 s...");
        setTimeout(launch, 5000);
      });

      tunnel.on("error", () => {
        console.log("  Tunnel error — reconnecting in 5 s...");
        tunnel.close();
      });
    } catch (err) {
      console.log("  Localtunnel failed (" + (err.message || err) + ") — falling back to SSH tunnel...");
      startSshTunnel();
    }
  }

  // Start Next.js after 12 s even if tunnel hasn't connected yet
  setTimeout(() => { if (!nextProcess) { console.log("  ⚠️  Tunnel slow — starting server now.\n"); startNextJs(); } }, 12000);
  await launch();
}
