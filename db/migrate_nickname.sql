-- Maturaziitig: Spitznamen fuer bestehende Profile.
-- Supabase -> SQL Editor -> New query -> einfuegen -> Run.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nickname" TEXT;
