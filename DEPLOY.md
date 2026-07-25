# Deploying Hotel Agrawal Inn to Vercel (Postgres)

The app previously used **SQLite** (`prisma/hotel.db`). That cannot work on
Vercel: serverless functions get a **read-only, temporary filesystem**, so there
is nowhere to keep the database file. Every request that touched the database
returned **HTTP 500**, which is why login failed with "Unable to sign in".

The app now uses **PostgreSQL**. Follow these steps once.

---

## Step 1 — Create a free Postgres database (Neon)

1. Go to <https://neon.tech> and sign up (free tier is plenty for a hotel).
2. Create a project — pick the region closest to you (Singapore or Mumbai for India).
3. On the dashboard, open **Connection Details** and copy **two** strings:
   - the **Pooled connection** string → this is your `DATABASE_URL`
   - the **Direct connection** string → this is your `DIRECT_URL`

Both look like:

```
postgresql://user:password@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

The pooled one contains `-pooler`. The direct one does not.

> Supabase works too — use the **Transaction pooler** URL for `DATABASE_URL`
> and the **Direct connection** URL for `DIRECT_URL`.

---

## Step 2 — Add environment variables in Vercel

Vercel dashboard → your project → **Settings** → **Environment Variables**.
Add these three for **Production, Preview and Development**:

| Name | Value |
|---|---|
| `DATABASE_URL` | the **pooled** Neon string |
| `DIRECT_URL` | the **direct** Neon string |
| `AUTH_SECRET` | a long random string — see below |

Generate a strong `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> ⚠️ **`AUTH_SECRET` is required.** Without it the login route throws
> `AUTH_SECRET environment variable is not set` and every sign-in fails.
> Changing it later logs everyone out (it invalidates existing session cookies).

Optional:

| Name | Value |
|---|---|
| `APP_BASE_URL` | `https://your-app.vercel.app` — used for room QR code links |

---

## Step 3 — Deploy

Push to GitHub. Vercel redeploys automatically.

The `build` script now runs `prisma generate && prisma migrate deploy` before
`next build`, so **the database tables are created automatically** on the first
deploy. You don't need to run migrations by hand.

---

## Step 4 — Create your login users

The new database is empty, so seed it. Locally, point at the **same** Neon
database and run:

```bash
# .env in the project root
DATABASE_URL="<pooled Neon string>"
DIRECT_URL="<direct Neon string>"
AUTH_SECRET="<the same secret you set in Vercel>"
```

```bash
npm install
npm run db:seed
```

That creates the rooms and both accounts.

### Bringing your existing data across (optional)

If you have real bookings and guests in the old `prisma/hotel.db`, copy them
into Postgres instead of seeding:

```bash
npm run db:migrate        # create the tables
npm run db:import-sqlite  # copy users, rooms, guests, bookings, payments...
```

The importer is safe to re-run — rows are matched by primary key, so an
interrupted run can just be started again. It needs the `sqlite3` command
available and reads `prisma/hotel.db` directly.

---

## Step 5 — Change the passwords 🔒

`prisma/hotel.db` was committed to the GitHub repo, and it contains the bcrypt
password hashes for both accounts. Anyone who cloned the repo can crack a weak
password offline. `AI9406851411` (initials + a phone number) is weak.

Do all of these:

1. **Change both passwords** to something long and random.
2. Give the manager and the owner **separate usernames** — they currently share
   `Hotel Agrawal Inn`, so the password alone decides which role you get.
3. The database file is now in `.gitignore`, but it is still in the repo's git
   **history**. To remove it properly:

```bash
git rm --cached prisma/hotel.db prisma/dev.db
git commit -m "Stop tracking local database files"
```

   For a full history purge use
   [git-filter-repo](https://github.com/newren/git-filter-repo).

To change a password, edit `prisma/seed.ts` and re-run `npm run db:seed`
(this wipes and recreates the data), or update the hash directly:

```bash
node -e "require('bcryptjs').hash('YOUR-NEW-PASSWORD',10).then(console.log)"
```

---

## Running locally

You can keep using Postgres locally (point `.env` at Neon), or install Postgres
on your PC. The old `Start Hotel.bat` one-click launcher still works — it just
needs a `.env` with the variables above.

```bash
npm install
npm run dev     # http://localhost:3000
```

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| `500` on login, empty response | `DATABASE_URL` missing or wrong in Vercel |
| `AUTH_SECRET environment variable is not set` | Add `AUTH_SECRET` in Vercel |
| `Can't reach database server` | Neon string missing `?sslmode=require` |
| `prepared statement "s0" already exists` | Using the **direct** URL as `DATABASE_URL` — use the **pooled** one |
| Tables don't exist | First deploy didn't run `prisma migrate deploy`; run `npm run db:migrate` locally against the same DB |
