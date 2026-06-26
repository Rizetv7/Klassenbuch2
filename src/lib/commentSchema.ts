import { prisma } from "./db";

let commentSchemaReady = false;

// Adds threaded-reply support to the existing Comment table without a manual
// migration step (the production build does not run `prisma db push`).
// Idempotent and safe to call on every request.
export async function ensureCommentSchema() {
  if (commentSchemaReady) return;

  const statements = [
    `ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "parentId" TEXT`,
    `CREATE INDEX IF NOT EXISTS "Comment_postId_idx" ON "Comment"("postId")`,
    `CREATE INDEX IF NOT EXISTS "Comment_parentId_idx" ON "Comment"("parentId")`,
    `DO $$ BEGIN
      ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ];

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  commentSchemaReady = true;
}
