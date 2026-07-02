import webpush from "web-push";
import { prisma } from "./db";

// ---------------------------------------------------------------------------
// Schema (runtime migration, same probe pattern as polls/comments)
// ---------------------------------------------------------------------------

let pushSchemaReady = false;
let pending: Promise<void> | null = null;

async function sentinelExists(): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<unknown[]>(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'PushSubscription' LIMIT 1`
  );
  return rows.length > 0;
}

export async function ensurePushSchema() {
  if (pushSchemaReady) return;
  if (!pending) {
    pending = run().finally(() => {
      pending = null;
    });
  }
  await pending;
}

async function run() {
  if (pushSchemaReady) return;
  if (await sentinelExists()) {
    pushSchemaReady = true;
    return;
  }

  const statements = [
    `CREATE TABLE IF NOT EXISTS "AppSetting" (
      "key" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
    )`,
    `CREATE TABLE IF NOT EXISTS "PushSubscription" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "endpoint" TEXT NOT NULL,
      "p256dh" TEXT NOT NULL,
      "auth" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint")`,
    `CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId")`,
    `DO $$ BEGIN
      ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ];

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  pushSchemaReady = true;
}

// ---------------------------------------------------------------------------
// VAPID keys — read from env if set, otherwise generated once and kept in the
// database. Zero configuration needed.
// ---------------------------------------------------------------------------

let cachedKeys: { publicKey: string; privateKey: string } | null = null;

export async function getVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  if (cachedKeys) return cachedKeys;

  const envPublic = process.env.VAPID_PUBLIC_KEY;
  const envPrivate = process.env.VAPID_PRIVATE_KEY;
  if (envPublic && envPrivate) {
    cachedKeys = { publicKey: envPublic, privateKey: envPrivate };
    return cachedKeys;
  }

  await ensurePushSchema();
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: ["vapidPublicKey", "vapidPrivateKey"] } },
  });
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  if (stored.vapidPublicKey && stored.vapidPrivateKey) {
    cachedKeys = { publicKey: stored.vapidPublicKey, privateKey: stored.vapidPrivateKey };
    return cachedKeys;
  }

  const generated = webpush.generateVAPIDKeys();
  // upserts so a concurrent cold start can't create duplicates
  await prisma.appSetting.upsert({
    where: { key: "vapidPublicKey" },
    create: { key: "vapidPublicKey", value: generated.publicKey },
    update: {},
  });
  await prisma.appSetting.upsert({
    where: { key: "vapidPrivateKey" },
    create: { key: "vapidPrivateKey", value: generated.privateKey },
    update: {},
  });
  // re-read: if another instance won the race, use its keys
  const finalRows = await prisma.appSetting.findMany({
    where: { key: { in: ["vapidPublicKey", "vapidPrivateKey"] } },
  });
  const final = Object.fromEntries(finalRows.map((r) => [r.key, r.value]));
  cachedKeys = { publicKey: final.vapidPublicKey, privateKey: final.vapidPrivateKey };
  return cachedKeys;
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

export type PushPayload = {
  title: string;
  body: string;
  url?: string; // opened when the notification is tapped
  tag?: string; // same tag replaces older notification instead of stacking
};

// Send a notification to every registered device of the given users.
// Never throws — notifications must not break the API request that fires them.
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  try {
    const ids = Array.from(new Set(userIds)).filter(Boolean);
    if (ids.length === 0) return;

    await ensurePushSchema();
    const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: ids } } });
    if (subs.length === 0) return;

    const keys = await getVapidKeys();
    const subject = process.env.VAPID_SUBJECT || "mailto:push@maturaziitig.app";
    const body = JSON.stringify(payload);

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body,
            {
              vapidDetails: { subject, publicKey: keys.publicKey, privateKey: keys.privateKey },
              TTL: 60 * 60 * 24,
            }
          );
        } catch (err: unknown) {
          const status = (err as { statusCode?: number })?.statusCode;
          // subscription expired or was revoked -> clean it up
          if (status === 404 || status === 410) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          }
        }
      })
    );
  } catch {
    // best-effort only
  }
}
