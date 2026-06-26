-- Maturaziitig: Personen-/Lehrpersonen-Rennen fuer Umfragen.
-- Additiv & idempotent, KEIN Datenverlust.
-- Supabase -> SQL Editor -> New query -> einfuegen -> Run.

ALTER TABLE "Poll" ADD COLUMN IF NOT EXISTS "candidateType" TEXT;

ALTER TABLE "PollOption" ADD COLUMN IF NOT EXISTS "subjectMembershipId" TEXT;
ALTER TABLE "PollOption" ADD COLUMN IF NOT EXISTS "teacherId" TEXT;

CREATE INDEX IF NOT EXISTS "PollOption_subjectMembershipId_idx" ON "PollOption"("subjectMembershipId");
CREATE INDEX IF NOT EXISTS "PollOption_teacherId_idx" ON "PollOption"("teacherId");

CREATE UNIQUE INDEX IF NOT EXISTS "PollOption_pollId_subjectMembershipId_key"
  ON "PollOption"("pollId", "subjectMembershipId")
  WHERE "subjectMembershipId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "PollOption_pollId_teacherId_key"
  ON "PollOption"("pollId", "teacherId")
  WHERE "teacherId" IS NOT NULL;

DO $$ BEGIN
  ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_subjectMembershipId_fkey" FOREIGN KEY ("subjectMembershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
