-- Owners may opt into Amina mode while retaining all class ownership safeguards.
ALTER TABLE "Membership"
DROP CONSTRAINT IF EXISTS "Membership_owner_no_amina";
