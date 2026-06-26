import { prisma } from "./db";
import { ensurePollSchema } from "./pollSchema";

let commentSchemaReady = false;

// Adds threaded-reply support and poll comments to the existing Comment table
// without a manual migration step (the production build does not run
// `prisma db push`). Idempotent and safe to call on every request.
export async function ensureCommentSchema() {
  if (commentSchemaReady) return;

  // The Poll table must exist before we can add the poll foreign key.
  await ensurePollSchema();

  const statements = [
    `ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "parentId" TEXT`,
    `ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "pollId" TEXT`,
    // comments can now hang off a poll instead of a post
    `ALTER TABLE "Comment" ALTER COLUMN "postId" DROP NOT NULL`,
    `CREATE INDEX IF NOT EXISTS "Comment_postId_idx" ON "Comment"("postId")`,
    `CREATE INDEX IF NOT EXISTS "Comment_pollId_idx" ON "Comment"("pollId")`,
    `CREATE INDEX IF NOT EXISTS "Comment_parentId_idx" ON "Comment"("parentId")`,
    `DO $$ BEGIN
      ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "Comment" ADD CONSTRAINT "Comment_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ];

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  commentSchemaReady = true;
}
