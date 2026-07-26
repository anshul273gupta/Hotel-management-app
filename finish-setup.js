#!/usr/bin/env node
/**
 * Hotel Agrawal Inn — one-command finisher.
 *
 * Run this from inside your project folder:
 *
 *     node finish-setup.js
 *
 * It will:
 *   1. apply the bug-fix + PostgreSQL patch (if not already applied)
 *   2. install dependencies
 *   3. ask for your Neon connection string and write .env
 *   4. create the database tables
 *   5. load your data (import from the old SQLite file, or seed fresh)
 *   6. push to GitHub so Vercel redeploys
 *
 * Safe to re-run. It skips any step that is already done, and it asks before
 * doing anything destructive.
 */

const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, (a) => res(a.trim())));

const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m", cyan: "\x1b[36m",
};
const ok = (m) => console.log(`${C.green}  OK${C.reset}  ${m}`);
const warn = (m) => console.log(`${C.yellow}  !!${C.reset}  ${m}`);
const fail = (m) => console.log(`${C.red}  XX${C.reset}  ${m}`);
const step = (n, m) => console.log(`\n${C.bold}${C.cyan}[${n}] ${m}${C.reset}`);

function sh(cmd, opts = {}) {
  return execSync(cmd, { encoding: "utf8", stdio: "pipe", ...opts }).trim();
}
function shLive(cmd) {
  const r = spawnSync(cmd, { shell: true, stdio: "inherit" });
  return r.status === 0;
}
function tryShell(cmd) {
  try { return { ok: true, out: sh(cmd) }; }
  catch (e) { return { ok: false, out: (e.stdout || "") + (e.stderr || "") }; }
}

async function main() {
  console.log(`${C.bold}\n  Hotel Agrawal Inn — finish setup${C.reset}`);
  console.log(`${C.dim}  This gets your live site working. Ctrl+C to stop at any time.${C.reset}`);

  // ── 0. sanity checks ──────────────────────────────────────────────────────
  step(0, "Checking the folder");

  if (!fs.existsSync("package.json") || !fs.existsSync("prisma/schema.prisma")) {
    fail("This doesn't look like the hotel project folder.");
    console.log("      Open a terminal INSIDE the project folder (the one with");
    console.log("      package.json in it) and run this script again.");
    process.exit(1);
  }
  ok("Found the project");

  if (!tryShell("git rev-parse --is-inside-work-tree").ok) {
    fail("This folder isn't a git repository — can't push from here.");
    process.exit(1);
  }
  ok("Git repository detected");

  // Git refuses to commit without an identity. Ask once and set it locally.
  if (!tryShell("git config user.email").out) {
    warn("Git doesn't know who you are yet.");
    const email = (await ask("      Your email: ")) || "you@example.com";
    const name = (await ask("      Your name:  ")) || "Hotel Admin";
    sh(`git config user.email "${email}"`);
    sh(`git config user.name "${name}"`);
    ok("Git identity set for this project");
  }

  // ── 1. apply the patch ────────────────────────────────────────────────────
  step(1, "Applying the fixes");

  const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
  if (schema.includes('provider = "postgresql"') || schema.includes('provider  = "postgresql"')) {
    ok("Fixes already applied — skipping");
  } else {
    const patch = ["hotel-fixes.patch", "../hotel-fixes.patch",
                   path.join(process.env.USERPROFILE || process.env.HOME || ".", "Downloads", "hotel-fixes.patch")]
      .find((p) => fs.existsSync(p));

    if (!patch) {
      fail("Can't find hotel-fixes.patch");
      console.log("      Download it from the chat and put it in this folder,");
      console.log("      then run this script again.");
      process.exit(1);
    }
    console.log(`      using ${patch}`);

    // Ignore the helper files themselves — they're not part of the project.
    const dirty = tryShell("git status --porcelain").out
      .split("\n")
      .filter((l) => l.trim() && !/(hotel-fixes\.patch|finish-setup\.js)$/.test(l))
      .join("\n");
    if (dirty) {
      warn("You have uncommitted changes:");
      console.log(dirty.split("\n").slice(0, 10).map((l) => "        " + l).join("\n"));
      const a = await ask("      Commit them first? (y/n) ");
      if (a.toLowerCase() === "y") {
        sh("git add -A");
        sh('git commit -m "Work in progress before applying fixes"');
        ok("Committed");
      }
    }

    const am = tryShell(`git am "${patch}"`);
    if (!am.ok) {
      tryShell("git am --abort");
      warn("git am failed, trying git apply instead...");
      const ap = tryShell(`git apply "${patch}"`);
      if (!ap.ok) {
        fail("Could not apply the patch:");
        console.log(ap.out.split("\n").slice(0, 8).map((l) => "        " + l).join("\n"));
        process.exit(1);
      }
      sh("git add -A");
      sh('git commit -m "Fix critical bugs and migrate SQLite -> PostgreSQL for Vercel"');
    }
    ok("Fixes applied and committed");
  }

  // ── 2. dependencies ───────────────────────────────────────────────────────
  step(2, "Installing dependencies (may take a minute)");
  if (!shLive("npm install --no-audit --no-fund")) {
    fail("npm install failed — check the messages above");
    process.exit(1);
  }
  ok("Dependencies installed");

  // ── 3. .env ───────────────────────────────────────────────────────────────
  step(3, "Database connection");

  let env = fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : "";
  const has = (k) => new RegExp(`^${k}=.+`, "m").test(env);
  const setVar = (k, v) => {
    const line = `${k}="${v}"`;
    env = new RegExp(`^${k}=.*$`, "m").test(env)
      ? env.replace(new RegExp(`^${k}=.*$`, "m"), line)
      : env.trimEnd() + "\n" + line + "\n";
  };

  if (has("DATABASE_URL") && env.includes("postgres")) {
    ok(".env already has a Postgres connection");
  } else {
    console.log(`\n${C.dim}      Paste your Neon connection string. Get it from neon.tech ->`);
    console.log(`      your project -> Connect button -> copy the string.`);
    console.log(`      It starts with postgresql:// ${C.reset}\n`);

    let conn = "";
    while (!conn.startsWith("postgresql://") && !conn.startsWith("postgres://")) {
      conn = await ask("      Connection string: ");
      if (!conn.startsWith("postgres")) fail("That doesn't start with postgresql:// — try again");
    }
    conn = conn.replace(/^["']|["']$/g, "");

    // Derive the pooled/direct pair from whichever one was pasted.
    const pooled = conn.includes("-pooler") ? conn : conn.replace(/@([^.]+)\./, "@$1-pooler.");
    const direct = conn.includes("-pooler") ? conn.replace("-pooler", "") : conn;

    setVar("DATABASE_URL", pooled);
    setVar("DIRECT_URL", direct);
    ok("Worked out both pooled and direct URLs");
  }

  if (!has("AUTH_SECRET")) {
    setVar("AUTH_SECRET", require("crypto").randomBytes(32).toString("hex"));
    ok("Generated AUTH_SECRET");
    warn("Copy this into Vercel too (Settings -> Environment Variables):");
    console.log("        " + env.match(/^AUTH_SECRET="(.+)"$/m)[1]);
  } else {
    ok("AUTH_SECRET already set");
  }

  fs.writeFileSync(".env", env);
  ok(".env saved");

  // ── 4. tables ─────────────────────────────────────────────────────────────
  step(4, "Creating the database tables");
  if (!shLive("npx prisma generate") || !shLive("npx prisma migrate deploy")) {
    fail("Could not set up the tables.");
    console.log("      Most likely the connection string is wrong, or Neon is asleep.");
    console.log("      Check it and run this script again.");
    process.exit(1);
  }
  ok("Tables created");

  // ── 5. data ───────────────────────────────────────────────────────────────
  step(5, "Loading your data");

  let count = 0;
  try {
    const { PrismaClient } = require("@prisma/client");
    const p = new PrismaClient();
    count = await p.user.count();
    await p.$disconnect();
  } catch { /* table may not exist yet */ }

  if (count > 0) {
    ok(`Database already has ${count} user account(s) — skipping`);
  } else {
    const hasOld = fs.existsSync("prisma/hotel.db");
    let choice = "s";
    if (hasOld) {
      console.log("\n      Found your old database file (prisma/hotel.db).");
      console.log("        [i] Import it  — keeps your real rooms, guests and bookings");
      console.log("        [s] Seed fresh — 12 demo rooms, wipes nothing (DB is empty)");
      choice = ((await ask("      Which? (i/s) ")) || "i").toLowerCase();
    }

    const cmd = choice === "i"
      ? "node scripts/migrate-sqlite-to-postgres.js"
      : "npm run db:seed";
    if (!shLive(cmd)) {
      fail("Loading data failed — see above");
      process.exit(1);
    }
    ok("Data loaded");
  }

  // ── 6. push ───────────────────────────────────────────────────────────────
  step(6, "Pushing to GitHub");

  const branch = tryShell("git rev-parse --abbrev-ref HEAD").out || "main";
  console.log(`      branch: ${branch}`);
  const a = await ask("      Push now so Vercel redeploys? (y/n) ");

  if (a.toLowerCase() === "y") {
    if (shLive(`git push origin ${branch}`)) {
      ok("Pushed — Vercel is redeploying now (takes 1-2 minutes)");
    } else {
      fail("Push failed. If it asked for a login, set up your GitHub");
      console.log("      credentials and run:  git push");
    }
  } else {
    warn("Skipped. Run 'git push' yourself when ready.");
  }

  // ── done ──────────────────────────────────────────────────────────────────
  console.log(`\n${C.bold}${C.green}  All done.${C.reset}\n`);
  console.log("  Next:");
  console.log("   1. Make sure Vercel has DATABASE_URL, DIRECT_URL and AUTH_SECRET");
  console.log("      set to the SAME values as your .env file");
  console.log("   2. Wait for the deploy, then open your site and log in");
  console.log(`\n  ${C.yellow}Then change both passwords${C.reset} — the old ones are in your`);
  console.log("  public GitHub history and are easy to crack.\n");

  rl.close();
}

main().catch((e) => {
  fail(e.message);
  rl.close();
  process.exit(1);
});
