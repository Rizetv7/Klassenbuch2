import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { getMembership, canModerate } from "@/lib/classAccess";

// Topic details (name + class).
export async function GET(_req: Request, { params }: { params: { topicId: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const topic = await prisma.topic.findUnique({
    where: { id: params.topicId },
    include: { class: { select: { id: true, name: true } } },
  });
  if (!topic) return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 });

  const membership = await getMembership(userId, topic.classId);
  if (!membership) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });

  return NextResponse.json({
    id: topic.id,
    name: topic.name,
    classId: topic.classId,
    className: topic.class.name,
    canDelete: topic.createdById === userId || canModerate(membership.role),
  });
}

// Delete a topic (creator or class moderator/owner).
export async function DELETE(_req: Request, { params }: { params: { topicId: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const topic = await prisma.topic.findUnique({ where: { id: params.topicId } });
  if (!topic) return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 });

  const membership = await getMembership(userId, topic.classId);
  const allowed = topic.createdById === userId || (membership && canModerate(membership.role));
  if (!allowed) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });

  await prisma.topic.delete({ where: { id: params.topicId } });
  return NextResponse.json({ ok: true });
}
