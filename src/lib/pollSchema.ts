import { prisma } from "./db";

let pollSchemaReady = false;

export async function ensurePollSchema() {
  if (pollSchemaReady) return;

  const statements = [
    `CREATE TABLE IF NOT EXISTS "Poll" (
      "id" TEXT NOT NULL,
      "classId" TEXT NOT NULL,
      "authorId" TEXT NOT NULL,
      "question" TEXT NOT NULL,
      "description" TEXT,
      "candidateType" TEXT,
      "anonymous" BOOLEAN NOT NULL DEFAULT false,
      "multipleChoice" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE TABLE IF NOT EXISTS "PollOption" (
      "id" TEXT NOT NULL,
      "pollId" TEXT NOT NULL,
      "text" TEXT NOT NULL,
      "position" INTEGER NOT NULL,
      "subjectMembershipId" TEXT,
      "teacherId" TEXT,
      CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE TABLE IF NOT EXISTS "PollVote" (
      "id" TEXT NOT NULL,
      "pollId" TEXT NOT NULL,
      "optionId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
    )`,
    `ALTER TABLE "Poll" ADD COLUMN IF NOT EXISTS "candidateType" TEXT`,
    `ALTER TABLE "PollOption" ADD COLUMN IF NOT EXISTS "subjectMembershipId" TEXT`,
    `ALTER TABLE "PollOption" ADD COLUMN IF NOT EXISTS "teacherId" TEXT`,
    `CREATE INDEX IF NOT EXISTS "Poll_classId_idx" ON "Poll"("classId")`,
    `CREATE INDEX IF NOT EXISTS "Poll_authorId_idx" ON "Poll"("authorId")`,
    `CREATE INDEX IF NOT EXISTS "PollOption_pollId_idx" ON "PollOption"("pollId")`,
    `CREATE INDEX IF NOT EXISTS "PollOption_subjectMembershipId_idx" ON "PollOption"("subjectMembershipId")`,
    `CREATE INDEX IF NOT EXISTS "PollOption_teacherId_idx" ON "PollOption"("teacherId")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PollOption_pollId_subjectMembershipId_key" ON "PollOption"("pollId", "subjectMembershipId") WHERE "subjectMembershipId" IS NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PollOption_pollId_teacherId_key" ON "PollOption"("pollId", "teacherId") WHERE "teacherId" IS NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PollOption_pollId_position_key" ON "PollOption"("pollId", "position")`,
    `CREATE INDEX IF NOT EXISTS "PollVote_pollId_userId_idx" ON "PollVote"("pollId", "userId")`,
    `CREATE INDEX IF NOT EXISTS "PollVote_userId_idx" ON "PollVote"("userId")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PollVote_optionId_userId_key" ON "PollVote"("optionId", "userId")`,
    `DO $$ BEGIN
      ALTER TABLE "Poll" ADD CONSTRAINT "Poll_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "Poll" ADD CONSTRAINT "Poll_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_subjectMembershipId_fkey" FOREIGN KEY ("subjectMembershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ];

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  pollSchemaReady = true;
}
