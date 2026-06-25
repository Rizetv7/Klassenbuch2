import { prisma } from "./db";

/** Returns the membership of a user in a class, or null if not a member. */
export async function getMembership(userId: string, classId: string) {
  return prisma.membership.findUnique({
    where: { userId_classId: { userId, classId } },
  });
}

export function canModerate(role: string): boolean {
  return role === "OWNER" || role === "MODERATOR";
}

/** Generate a short, human-friendly, unique join code (e.g. "K7XQ2A"). */
export async function generateJoinCode(): Promise<string> {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    const existing = await prisma.class.findUnique({ where: { joinCode: code } });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique join code");
}
