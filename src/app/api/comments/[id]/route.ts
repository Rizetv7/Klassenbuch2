import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { getMembership, canModerate } from "@/lib/classAccess";
import { ensureCommentSchema } from "@/lib/commentSchema";

// Delete a comment: allowed for its author or a class moderator/owner.
// Replies cascade away with their parent (DB-level ON DELETE CASCADE).
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  await ensureCommentSchema();

  const comment = await prisma.comment.findUnique({
    where: { id: params.id },
    include: { post: { select: { classId: true } } },
  });
  if (!comment) return NextResponse.json({ error: "Kommentar nicht gefunden." }, { status: 404 });

  const membership = await getMembership(userId, comment.post.classId);
  const isAuthor = comment.authorId === userId;
  if (!isAuthor && !(membership && canModerate(membership.role))) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  await prisma.comment.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
