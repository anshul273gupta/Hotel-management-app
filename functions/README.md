# Firebase Cloud Functions — no longer used

`index.js` in this folder is **dead code**. It is kept only for reference and is
not deployed.

## Why

It was written to send push notifications by watching **Firestore**:

```js
const snapshot = await db.collection("fcm_tokens").get();
```

But the app stores device tokens in **PostgreSQL**, via Prisma:

```js
await prisma.deviceToken.upsert({ where: { token }, ... });
```

Those are two different databases. The Cloud Function would never have seen a
single token, so it could never have sent anything — the two halves were never
connected.

## What happens instead

Push is now sent directly from the Next.js app in
`src/lib/firebase-admin.ts` → `pushNotificationToCloud()`, using the same
Postgres `DeviceToken` table the app already writes to. One database, one code
path, nothing to keep in sync.

## If you ever want to delete this folder

Nothing imports it and it isn't part of the build:

```bash
git rm -r functions
```

It is left in place only so the history of the original approach isn't lost.
