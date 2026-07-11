import { prisma } from "./db";

let importSchemaReady = false;
let pending: Promise<void> | null = null;

// Fast path: one probe query for the newest import-batch elements. Older
// deployments already have ImportItem, so that table alone is not a useful
// migration sentinel anymore.
async function sentinelExists(): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ ready: boolean }>>(
    `SELECT
      to_regclass('public."ImportBatch"') IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Post' AND column_name = 'importBatchId'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ImportItem' AND column_name = 'importBatchId'
      ) AS ready`
  );
  return rows[0]?.ready === true;
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
    `CREATE TABLE IF NOT EXISTS "ImportBatch" (
      "id" TEXT NOT NULL,
      "classId" TEXT NOT NULL,
      "createdById" TEXT NOT NULL,
      "sourceType" TEXT NOT NULL DEFAULT 'PASTE',
      "sourceText" TEXT,
      "itemCount" INTEGER NOT NULL,
      "anonymizedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
    )`,
    `ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "importBatchId" TEXT`,
    `ALTER TABLE "ImportItem" ADD COLUMN IF NOT EXISTS "importBatchId" TEXT`,
    `CREATE INDEX IF NOT EXISTS "ImportItem_classId_idx" ON "ImportItem"("classId")`,
    `CREATE INDEX IF NOT EXISTS "ImportItem_createdById_idx" ON "ImportItem"("createdById")`,
    `CREATE INDEX IF NOT EXISTS "ImportItem_importBatchId_idx" ON "ImportItem"("importBatchId")`,
    `CREATE INDEX IF NOT EXISTS "Post_importBatchId_idx" ON "Post"("importBatchId")`,
    `CREATE INDEX IF NOT EXISTS "ImportBatch_classId_createdAt_idx" ON "ImportBatch"("classId", "createdAt")`,
    `CREATE INDEX IF NOT EXISTS "ImportBatch_createdById_idx" ON "ImportBatch"("createdById")`,
    `DO $$ BEGIN
      ALTER TABLE "ImportItem" ADD CONSTRAINT "ImportItem_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "ImportItem" ADD CONSTRAINT "ImportItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "Post" ADD CONSTRAINT "Post_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "ImportItem" ADD CONSTRAINT "ImportItem_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `ALTER TABLE "ImportBatch" ENABLE ROW LEVEL SECURITY`,
    // Before batches existed, a pasted import left only a rapid sequence of
    // posts. Backfill only unmistakable bulk runs: at least 20 entries about
    // at least 5 targets, by one author, with no gap above 15 seconds. This
    // intentionally ignores small ambiguous bursts such as multi-photo posts.
    `WITH ordered AS (
      SELECT
        p."id",
        p."classId",
        p."authorId",
        p."subjectMembershipId",
        p."teacherId",
        p."createdAt",
        LAG(p."createdAt") OVER (
          PARTITION BY p."classId", p."authorId"
          ORDER BY p."createdAt"
        ) AS previous_at
      FROM "Post" p
      WHERE p."importBatchId" IS NULL
    ), marked AS (
      SELECT *,
        CASE WHEN previous_at IS NULL OR "createdAt" - previous_at > INTERVAL '15 seconds'
          THEN 1 ELSE 0 END AS new_group
      FROM ordered
    ), clustered AS (
      SELECT *,
        SUM(new_group) OVER (
          PARTITION BY "classId", "authorId"
          ORDER BY "createdAt"
        ) AS group_no
      FROM marked
    ), eligible AS (
      SELECT
        "classId",
        "authorId",
        group_no,
        MIN("createdAt") AS first_at,
        COUNT(*)::INTEGER AS item_count
      FROM clustered
      GROUP BY "classId", "authorId", group_no
      HAVING COUNT(*) >= 20
        AND COUNT(DISTINCT COALESCE(
          's:' || "subjectMembershipId",
          't:' || "teacherId",
          'none'
        )) >= 5
    ), batches AS (
      SELECT
        'legacy_' || MD5("classId" || '|' || "authorId" || '|' || first_at::TEXT) AS id,
        "classId",
        "authorId",
        group_no,
        first_at,
        item_count
      FROM eligible
    ), upserted AS (
      INSERT INTO "ImportBatch" (
        "id", "classId", "createdById", "sourceType", "sourceText", "itemCount", "createdAt"
      )
      SELECT id, "classId", "authorId", 'LEGACY_DETECTED', NULL, item_count, first_at
      FROM batches
      ON CONFLICT ("id") DO UPDATE SET "itemCount" = EXCLUDED."itemCount"
      RETURNING "id"
    )
    UPDATE "Post" p
    SET "importBatchId" = b.id
    FROM clustered c
    JOIN batches b
      ON b."classId" = c."classId"
      AND b."authorId" = c."authorId"
      AND b.group_no = c.group_no
    JOIN upserted u ON u."id" = b.id
    WHERE p."id" = c."id" AND p."importBatchId" IS NULL`,
  ];

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  importSchemaReady = true;
}
