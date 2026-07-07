import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { isAminaName } from "@/lib/aminaMode";
import { prisma } from "@/lib/db";
import { postInclude, serializePostRows } from "@/lib/serializePost";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, avatarUrl: true, accentColor: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Profil nicht gefunden." }, { status: 404 });
  }
  if (!isAminaName(user.name)) {
    return NextResponse.json({ error: "Dieser Modus ist nur für Amina." }, { status: 403 });
  }

  const membership = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { classId: true, class: { select: { id: true, name: true } } },
  });

  if (!membership) {
    return NextResponse.json(
      { user, class: null, targets: [], posts: [] },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const [members, teachers, rows] = await Promise.all([
    prisma.membership.findMany({
      where: { classId: membership.classId },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        user: {
          select: { name: true, avatarUrl: true, accentColor: true },
        },
      },
    }),
    prisma.teacher.findMany({
      where: { classId: membership.classId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, subject: true, avatarUrl: true, accentColor: true },
    }),
    prisma.post.findMany({
      where: { classId: membership.classId },
      orderBy: { createdAt: "desc" },
      take: 160,
      include: postInclude(userId),
    }),
  ]);

  const posts = await serializePostRows(rows);
  const subjectAvatar = new Map<string, string>();
  const teacherAvatar = new Map<string, string>();
  for (const post of posts) {
    if (post.subject?.id && post.subject.avatarUrl) subjectAvatar.set(post.subject.id, post.subject.avatarUrl);
    if (post.teacher?.id && post.teacher.avatarUrl) teacherAvatar.set(post.teacher.id, post.teacher.avatarUrl);
  }

  const targets = [
    ...members.map((member) => ({
      id: member.id,
      type: "student" as const,
      name: member.user.name,
      detail: "Schüler:in",
      avatarUrl: member.user.avatarUrl ?? subjectAvatar.get(member.id) ?? null,
      accentColor: member.user.accentColor,
    })),
    ...teachers.map((teacher) => ({
      id: teacher.id,
      type: "teacher" as const,
      name: teacher.name,
      detail: teacher.subject || "Lehrperson",
      avatarUrl: teacher.avatarUrl ?? teacherAvatar.get(teacher.id) ?? null,
      accentColor: teacher.accentColor,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name, "de-CH"));

  return NextResponse.json(
    { user, class: membership.class, targets, posts },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
