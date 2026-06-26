import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { canModerate, getMembership } from "@/lib/classAccess";
import { ensurePollSchema } from "@/lib/pollSchema";

export async function DELETE(
  _req: Request,
  { params }: { params: { pollId: string } }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  await ensurePollSchema();

  const poll = await prisma.poll.findUnique({
    where: { id: params.pollId },
    select: { id: true, classId: true, authorId: true },
  });
  if (!poll) return NextResponse.json({ error: "Umfrage nicht gefunden." }, { status: 404 });

  const membership = await getMembership(userId, poll.classId);
  if (!membership) return NextResponse.json({ error: "Du bist kein Mitglied dieser Klasse." }, { status: 403 });
  if (poll.authorId !== userId && !canModerate(membership.role)) {
    return NextResponse.json({ error: "Du darfst diese Umfrage nicht löschen." }, { status: 403 });
  }

  await prisma.poll.delete({ where: { id: poll.id } });
  return NextResponse.json({ ok: true });
}
