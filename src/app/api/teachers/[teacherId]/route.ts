import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { getMembership, canModerate } from "@/lib/classAccess";

export async function GET(_req: Request, { params }: { params: { teacherId: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const teacher = await prisma.teacher.findUnique({
    where: { id: params.teacherId },
    include: { class: { select: { id: true, name: true } } },
  });
  if (!teacher) return NextResponse.json({ error: "Lehrperson nicht gefunden." }, { status: 404 });

  const membership = await getMembership(userId, teacher.classId);
  if (!membership) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });

  return NextResponse.json({
    id: teacher.id,
    name: teacher.name,
    subject: teacher.subject,
    avatarUrl: teacher.avatarUrl,
    accentColor: teacher.accentColor,
    classId: teacher.classId,
    className: teacher.class.name,
  });
}

// Update a teacher (name / subject / avatar). Any member may edit.
export async function PATCH(req: Request, { params }: { params: { teacherId: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const teacher = await prisma.teacher.findUnique({ where: { id: params.teacherId } });
  if (!teacher) return NextResponse.json({ error: "Lehrperson nicht gefunden." }, { status: 404 });
  const membership = await getMembership(userId, teacher.classId);
  if (!membership) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });

  const { name, subject, avatarUrl } = await req.json().catch(() => ({}));
  const data: { name?: string; subject?: string | null; avatarUrl?: string } = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (typeof subject === "string") data.subject = subject.trim() || null;
  if (typeof avatarUrl === "string") data.avatarUrl = avatarUrl;

  const updated = await prisma.teacher.update({ where: { id: params.teacherId }, data });
  return NextResponse.json({ id: updated.id });
}

// Delete a teacher (creator or class moderator/owner).
export async function DELETE(_req: Request, { params }: { params: { teacherId: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const teacher = await prisma.teacher.findUnique({ where: { id: params.teacherId } });
  if (!teacher) return NextResponse.json({ error: "Lehrperson nicht gefunden." }, { status: 404 });
  const membership = await getMembership(userId, teacher.classId);
  const allowed = teacher.createdById === userId || (membership && canModerate(membership.role));
  if (!allowed) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });

  await prisma.teacher.delete({ where: { id: params.teacherId } });
  return NextResponse.json({ ok: true });
}
