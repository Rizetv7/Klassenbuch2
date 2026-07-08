import { prisma } from "./db";

let loginCodeSchemaReady = false;
let pending: Promise<void> | null = null;

// Fast path: one probe query — if the LoginCode table exists, skip.
async function sentinelExists(): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<unknown[]>(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'LoginCode' LIMIT 1`
  );
  return rows.length > 0;
}

export async function ensureLoginCodeSchema() {
  if (loginCodeSchemaReady) return;
  if (!pending) {
    pending = run().finally(() => {
      pending = null;
    });
  }
  await pending;
}

async function run() {
  if (loginCodeSchemaReady) return;
  if (await sentinelExists()) {
    loginCodeSchemaReady = true;
    return;
  }

  const statements = [
    `CREATE TABLE IF NOT EXISTS "LoginCode" (
      "id" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "purpose" TEXT NOT NULL DEFAULT 'login',
      "codeHash" TEXT NOT NULL,
      "userId" TEXT,
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "LoginCode_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE INDEX IF NOT EXISTS "LoginCode_email_idx" ON "LoginCode"("email")`,
  ];

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  loginCodeSchemaReady = true;
}
