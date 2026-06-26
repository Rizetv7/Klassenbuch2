-- Maturaziitig: Projekte/Themen hinzufügen (additiv, idempotent).
-- Legt die Tabelle "Topic" und die Spalte "Post.topicId" an.
-- KEIN Datenverlust. Supabase -> SQL Editor -> New query -> einfügen -> Run.

CREATE TABLE IF NOT EXISTS "Topic" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "topicId" TEXT;

CREATE INDEX IF NOT EXISTS "Topic_classId_idx" ON "Topic"("classId");
CREATE INDEX IF NOT EXISTS "Post_topicId_idx" ON "Post"("topicId");

DO $$ BEGIN
  ALTER TABLE "Topic" ADD CONSTRAINT "Topic_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Topic" ADD CONSTRAINT "Topic_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Post" ADD CONSTRAINT "Post_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
