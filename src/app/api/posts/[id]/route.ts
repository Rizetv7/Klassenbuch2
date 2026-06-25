import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { getMembership, canModerate } from "@/lib/classAccess";

// Delete a post: allowed for the author, or a class moderator/owner.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const post = await prisma.post.findUnique({ where: { id: params.id } });
  if (!post) return NextResponse.json({ error: "Beitrag nicht gefunden." }, { status: 404 });

  const membership = await getMembership(userId, post.classId);
  const isAuthor = post.authorId === userId;
  if (!isAuthor && !(membership && canModerate(membership.role))) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  await prisma.post.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
