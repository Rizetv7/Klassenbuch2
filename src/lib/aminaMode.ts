import { prisma } from "./db";

export async function getAminaMembership(userId: string) {
  return prisma.membership.findFirst({
    where: {
      userId,
      aminaMode: true,
      leftAt: null,
      class: { archivedAt: null },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function hasAminaMode(userId: string): Promise<boolean> {
  return Boolean(await getAminaMembership(userId));
}
