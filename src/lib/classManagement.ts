import { prisma } from "./db";
import { MemberManagementError } from "./memberManagement";

export async function archiveClass(classId: string) {
  await prisma.$transaction([
    prisma.membership.updateMany({ where: { classId }, data: { aminaMode: false } }),
    prisma.class.update({ where: { id: classId }, data: { archivedAt: new Date() } }),
  ]);
}

export async function restoreArchivedClass(classId: string) {
  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      id: true,
      ownerId: true,
      memberships: {
        where: { leftAt: null },
        select: { id: true, userId: true, role: true },
      },
    },
  });
  if (!klass) throw new MemberManagementError("Klasse nicht gefunden.", 404);

  const activeElsewhere = await prisma.membership.findMany({
    where: {
      userId: { in: klass.memberships.map((membership) => membership.userId) },
      classId: { not: classId },
      leftAt: null,
      class: { archivedAt: null },
    },
    select: { userId: true, class: { select: { name: true } } },
  });
  const ownerConflict = activeElsewhere.find((membership) => membership.userId === klass.ownerId);
  if (ownerConflict) {
    throw new MemberManagementError(
      `Die Klassenleitung leitet inzwischen „${ownerConflict.class.name}“. Diese Klasse zuerst archivieren.`,
      409,
    );
  }

  const conflictedUserIds = new Set(activeElsewhere.map((membership) => membership.userId));
  const conflictedMembershipIds = klass.memberships
    .filter((membership) => conflictedUserIds.has(membership.userId))
    .map((membership) => membership.id);

  await prisma.$transaction([
    ...(conflictedMembershipIds.length
      ? [
          prisma.membership.updateMany({
            where: { id: { in: conflictedMembershipIds } },
            data: { leftAt: new Date(), aminaMode: false, role: "MEMBER" },
          }),
        ]
      : []),
    prisma.class.update({ where: { id: classId }, data: { archivedAt: null } }),
  ]);

  return { removedConflicts: conflictedMembershipIds.length };
}
