import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { getMembership } from "@/lib/classAccess";
import { firstImageByTeacher } from "@/lib/effectiveAvatar";

const ACCENTS = ["#7E5BD9", "#8FB6EF", "#C77ACF", "#B68CF0", "#6FA8E8", "#E49ED0"];

// List teachers (created entries) of a class.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const membership = await getMembership(userId, params.id);
  if (!membership) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });

  const teachers = await prisma.teacher.findMany({
    where: { classId: params.id },
    include: { _count: { select: { posts: true } } },
    orderBy: { name: "asc" },
  });

  // Fall back to the newest posted image for teachers without a chosen avatar.
  const fallbackImg = await firstImageByTeacher(
    teachers.filter((t) => !t.avatarUrl).map((t) => t.id),
  );

  return NextResponse.json({
    teachers: teachers.map((t) => ({
      id: t.id,
      name: t.name,
      subject: t.subject,
      avatarUrl: t.avatarUrl ?? fallbackImg.get(t.id) ?? null,
      manualAvatarUrl: t.avatarUrl,
      accentColor: t.accentColor,
      postCount: t._count.posts,
    })),
  });
}

// Create a teacher entry (any member can).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const membership = await getMembership(userId, params.id);
  if (!membership) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });

  const { name, subject } = await req.json().catch(() => ({}));
  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: "Name der Lehrperson fehlt." }, { status: 400 });
  }

  const teacher = await prisma.teacher.create({
    data: {
      classId: params.id,
      name: String(name).trim(),
      subject: subject ? String(subject).trim() : null,
      accentColor: ACCENTS[Math.floor(Math.random() * ACCENTS.length)],
      createdById: userId,
    },
  });
  return NextResponse.json({ id: teacher.id });
}
