#!/usr/bin/env node
/**
 * Change the login passwords (and optionally the usernames) safely.
 *
 *     node change-password.js
 *
 * Works against whatever database DATABASE_URL points at — your Neon database
 * once .env is set up. Passwords are hashed with bcrypt; the plain text is
 * never stored anywhere.
 */

const readline = require("readline");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m", cyan: "\x1b[36m",
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, (a) => r(a.trim())));

/** Reads input without echoing it to the screen. */
function askHidden(query) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(query);
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);
    let value = "";
    const onData = (chunk) => {
      const ch = chunk.toString("utf8");
      switch (ch) {
        case "\n": case "\r": case "\u0004":
          if (stdin.isTTY) stdin.setRawMode(wasRaw);
          stdin.removeListener("data", onData);
          process.stdout.write("\n");
          resolve(value);
          break;
        case "\u0003":
          process.stdout.write("\n");
          process.exit(1);
          break;
        case "\u007f": case "\b":
          if (value.length) { value = value.slice(0, -1); process.stdout.write("\b \b"); }
          break;
        default:
          if (ch >= " ") { value += ch; process.stdout.write("*"); }
      }
    };
    stdin.on("data", onData);
    stdin.resume();
  });
}

function strength(pw) {
  const issues = [];
  if (pw.length < 10) issues.push("shorter than 10 characters");
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) issues.push("no mix of upper and lower case");
  if (!/[0-9]/.test(pw)) issues.push("no digits");
  if (!/[^A-Za-z0-9]/.test(pw)) issues.push("no symbols");
  if (/^\d+$/.test(pw)) issues.push("digits only");
  return issues;
}

function suggest() {
  const words = ["Tiger", "Lotus", "River", "Mango", "Cloud", "Amber", "Coral", "Pearl",
                 "Stone", "Ivory", "Cedar", "Falcon", "Marble", "Saffron"];
  const pick = () => words[require("crypto").randomInt(words.length)];
  const n = require("crypto").randomInt(1000, 9999);
  const sym = "!@#$%&*"[require("crypto").randomInt(7)];
  return `${pick()}-${pick()}-${n}${sym}`;
}

async function main() {
  console.log(`${C.bold}\n  Change login passwords${C.reset}`);

  if (!process.env.DATABASE_URL) {
    // Load .env manually so this works without extra dependencies.
    try {
      const fs = require("fs");
      for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
        if (m) process.env[m[1]] ??= m[2];
      }
    } catch {
      console.log(`${C.red}  No .env file found and DATABASE_URL isn't set.${C.reset}`);
      console.log("  Run this from inside your project folder.");
      process.exit(1);
    }
  }

  const prisma = new PrismaClient();
  const users = await prisma.user.findMany({
    select: { id: true, name: true, username: true, email: true, role: true },
    orderBy: { role: "asc" },
  });

  if (!users.length) {
    console.log(`${C.red}  No accounts found in the database.${C.reset}`);
    console.log("  Run 'npm run db:seed' first.");
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`\n${C.dim}  Accounts in the database:${C.reset}`);
  users.forEach((u, i) => {
    console.log(`    [${i + 1}] ${u.role.padEnd(8)} ${u.name.padEnd(14)} username: ${C.cyan}${u.username ?? "(none)"}${C.reset}`);
  });

  const shared = new Set(users.map((u) => u.username)).size < users.length;
  if (shared) {
    console.log(`\n${C.yellow}  Warning: these accounts share a username.${C.reset}`);
    console.log(`${C.dim}  Only the password decides which role you get. Giving them`);
    console.log(`  separate usernames is safer.${C.reset}`);
  }

  const pick = await ask(`\n  Which account? (1-${users.length}, or 'a' for all) `);
  const targets = pick.toLowerCase() === "a"
    ? users
    : [users[parseInt(pick, 10) - 1]].filter(Boolean);

  if (!targets.length) {
    console.log(`${C.red}  Invalid choice.${C.reset}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  for (const user of targets) {
    console.log(`\n${C.bold}  ${user.role} — ${user.name}${C.reset}`);

    const newUsername = await ask(`  New username (Enter to keep "${user.username ?? ""}"): `);

    console.log(`${C.dim}  Suggestion: ${suggest()}${C.reset}`);
    let pw = "";
    while (true) {
      pw = await askHidden("  New password: ");
      if (!pw) { console.log(`${C.red}  Cannot be empty.${C.reset}`); continue; }
      const issues = strength(pw);
      if (issues.length) {
        console.log(`${C.yellow}  Weak: ${issues.join(", ")}.${C.reset}`);
        const go = await ask("  Use it anyway? (y/n) ");
        if (go.toLowerCase() !== "y") continue;
      }
      const again = await askHidden("  Repeat password: ");
      if (again !== pw) { console.log(`${C.red}  They don't match — try again.${C.reset}`); continue; }
      break;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(pw, 12),
        ...(newUsername ? { username: newUsername } : {}),
      },
    });
    console.log(`${C.green}  Updated.${C.reset}`);
  }

  await prisma.$disconnect();
  rl.close();

  console.log(`\n${C.green}${C.bold}  Done.${C.reset}`);
  console.log(`${C.dim}  Everyone stays logged in until their session expires. To force`);
  console.log(`  an immediate logout everywhere, change AUTH_SECRET in Vercel.${C.reset}\n`);
}

main().catch((e) => {
  console.error(`${C.red}  Failed: ${e.message}${C.reset}`);
  rl.close();
  process.exit(1);
});
