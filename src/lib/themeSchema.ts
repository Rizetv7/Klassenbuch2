import { prisma } from "./db";

let themeSchemaReady = false;
let pending: Promise<void> | null = null;

// Fast path: one probe query. If Class.theme exists, the migration has run.
async function sentinelExists(): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<unknown[]>(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Class' AND column_name = 'theme' LIMIT 1`
  );
  return rows.length > 0;
}

export async function ensureThemeSchema() {
  if (themeSchemaReady) return;
  if (!pending) {
    pending = run().finally(() => {
      pending = null;
    });
  }
  await pending;
}

async function run() {
  if (themeSchemaReady) return;
  if (await sentinelExists()) {
    themeSchemaReady = true;
    return;
  }

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "theme" TEXT NOT NULL DEFAULT 'standard'`
  );

  themeSchemaReady = true;
}
