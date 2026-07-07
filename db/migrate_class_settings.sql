-- Additive and reversible class settings migration.
-- Existing class and membership rows are copied to a private backup schema
-- before any column is added. No user content is deleted.

CREATE SCHEMA IF NOT EXISTS maturaziitig_backup;

CREATE TABLE IF NOT EXISTS maturaziitig_backup.class_before_settings_20260707
AS SELECT * FROM public."Class";

CREATE TABLE IF NOT EXISTS maturaziitig_backup.membership_before_settings_20260707
AS SELECT * FROM public."Membership";

ALTER TABLE public."Class"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

ALTER TABLE public."Membership"
  ADD COLUMN IF NOT EXISTS "aminaMode" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "leftAt" TIMESTAMP(3);

-- Preserve the existing name-based Amina experience for active non-owners.
UPDATE public."Membership" AS membership
SET "aminaMode" = true
FROM public."User" AS account
WHERE membership."userId" = account.id
  AND membership.role <> 'OWNER'
  AND membership."leftAt" IS NULL
  AND lower(split_part(btrim(account.name), ' ', 1)) = 'amina';

UPDATE public."Membership"
SET "aminaMode" = false
WHERE role = 'OWNER';

DO $$ BEGIN
  ALTER TABLE public."Membership"
    ADD CONSTRAINT "Membership_owner_no_amina"
    CHECK (role <> 'OWNER' OR "aminaMode" = false)
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."Membership"
  VALIDATE CONSTRAINT "Membership_owner_no_amina";

CREATE INDEX IF NOT EXISTS "Class_archivedAt_idx"
  ON public."Class"("archivedAt");

CREATE INDEX IF NOT EXISTS "Membership_classId_active_idx"
  ON public."Membership"("classId")
  WHERE "leftAt" IS NULL;

CREATE INDEX IF NOT EXISTS "Membership_userId_active_idx"
  ON public."Membership"("userId")
  WHERE "leftAt" IS NULL;

CREATE INDEX IF NOT EXISTS "Membership_aminaMode_active_idx"
  ON public."Membership"("userId", "classId")
  WHERE "aminaMode" = true AND "leftAt" IS NULL;
