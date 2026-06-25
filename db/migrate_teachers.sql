-- Klassenbuch: Lehrpersonen-Einträge, anonyme Zitate, "wer hat's gesagt".
-- Additiv & idempotent, KEIN Datenverlust.
-- Supabase -> SQL Editor -> New query -> einfügen -> Run.

CREATE TABLE IF NOT EXISTS "Teacher" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "avatarUrl" TEXT,
    "accentColor" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "teacherId" TEXT;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "saidByName" TEXT;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "anonymous" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Teacher_classId_idx" ON "Teacher"("classId");
CREATE INDEX IF NOT EXISTS "Post_teacherId_idx" ON "Post"("teacherId");

DO $$ BEGIN
  ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Post" ADD CONSTRAINT "Post_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
