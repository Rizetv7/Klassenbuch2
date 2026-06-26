-- Maturaziitig: Import-Zwischenspeicher fuer spaeteres Matching.
-- Additiv & idempotent, KEIN Datenverlust.
-- Supabase -> SQL Editor -> New query -> einfuegen -> Run.

CREATE TABLE IF NOT EXISTS "ImportItem" (
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
);

CREATE INDEX IF NOT EXISTS "ImportItem_classId_idx" ON "ImportItem"("classId");
CREATE INDEX IF NOT EXISTS "ImportItem_createdById_idx" ON "ImportItem"("createdById");

DO $$ BEGIN
  ALTER TABLE "ImportItem" ADD CONSTRAINT "ImportItem_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ImportItem" ADD CONSTRAINT "ImportItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
