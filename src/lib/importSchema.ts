import { prisma } from "./db";

let importSchemaReady = false;
let pending: Promise<void> | null = null;

// Fast path: one probe query — if the ImportItem table exists, skip.
async function sentinelExists(): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<unknown[]>(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ImportItem' LIMIT 1`
  );
  return rows.length > 0;
}

export async function ensureImportSchema() {
  if (importSchemaReady) return;
  if (!pending) {
    pending = run().finally(() => {
      pending = null;
    });
  }
  await pending;
}

async function run() {
  if (importSchemaReady) return;
  if (await sentinelExists()) {
    importSchemaReady = true;
    return;
  }

  const statements = [
    `CREATE TABLE IF NOT EXISTS "ImportItem" (
      "id" TEXT NOT NULL,
      "classId" TEXT NOT NULL,
      "createdById" TEXT NOT NULL,
      "rawName" TEXT NOT NULL,
      "targetType" TEXT NOT NULL DEFAULT 'STUDENT',
      "kind" TEXT NOT NULL DEFAULT 'QUOTE',
      "text" TEXT,
      "context" TEXT,
      "imageUrl" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ImportItem_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE INDEX IF NOT EXISTS "ImportItem_classId_idx" ON "ImportItem"("classId")`,
    `CREATE INDEX IF NOT EXISTS "ImportItem_createdById_idx" ON "ImportItem"("createdById")`,
    `DO $$ BEGIN
      ALTER TABLE "ImportItem" ADD CONSTRAINT "ImportItem_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "ImportItem" ADD CONSTRAINT "ImportItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ];

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  importSchemaReady = true;
}
