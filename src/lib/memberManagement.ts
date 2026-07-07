import { prisma } from "./db";

export class MemberManagementError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

async function assertNoOtherActiveClass(userId: string, classId: string) {
  const other = await prisma.membership.findFirst({
    where: {
      userId,
      classId: { not: classId },
      leftAt: null,
      class: { archivedAt: null },
    },
    select: { class: { select: { name: true } } },
  });
  if (other) {
    throw new MemberManagementError(`Diese Person ist bereits in „${other.class.name}“.`, 409);
  }
}

export async function addExistingUserToClass(classId: string, rawName: unknown) {
  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (name.length < 2) {
    throw new MemberManagementError("Bitte den genauen Kontonamen eingeben.");
  }

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { archivedAt: true },
  });
  if (!klass) throw new MemberManagementError("Klasse nicht gefunden.", 404);
  if (klass.archivedAt) throw new MemberManagementError("Eine archivierte Klasse muss zuerst wiederhergestellt werden.", 409);

  const user = await prisma.user.findUnique({
    where: { name },
    select: { id: true, name: true, avatarUrl: true, accentColor: true },
  });
  if (!user) {
    throw new MemberManagementError("Kein Konto mit diesem Namen gefunden.", 404);
  }

  await assertNoOtherActiveClass(user.id, classId);
  const existing = await prisma.membership.findUnique({
    where: { userId_classId: { userId: user.id, classId } },
  });
  if (existing?.leftAt === null) {
    throw new MemberManagementError("Diese Person ist bereits in der Klasse.", 409);
  }

  const membership = existing
    ? await prisma.membership.update({
        where: { id: existing.id },
        data: {
          leftAt: null,
          aminaMode: false,
          role: "MEMBER",
          displayName: user.name,
        },
      })
    : await prisma.membership.create({
        data: {
          userId: user.id,
          classId,
          role: "MEMBER",
          memberType: "STUDENT",
          displayName: user.name,
          aminaMode: false,
        },
      });

  return { membership, user, restored: Boolean(existing) };
}

export async function restoreMembership(classId: string, membershipId: string) {
  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { archivedAt: true },
  });
  if (!klass) throw new MemberManagementError("Klasse nicht gefunden.", 404);
  if (klass.archivedAt) throw new MemberManagementError("Die Klasse muss zuerst wiederhergestellt werden.", 409);

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, classId },
  });
  if (!membership) throw new MemberManagementError("Mitglied nicht gefunden.", 404);
  if (membership.leftAt === null) return membership;

  await assertNoOtherActiveClass(membership.userId, classId);
  return prisma.membership.update({
    where: { id: membership.id },
    data: { leftAt: null, aminaMode: false, role: "MEMBER" },
  });
}
