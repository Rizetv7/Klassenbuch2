import { prisma } from "./db";

let userNicknameColumnReady = false;

export async function ensureUserNicknameColumn() {
  if (userNicknameColumnReady) return;
  await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nickname" TEXT');
  userNicknameColumnReady = true;
}
