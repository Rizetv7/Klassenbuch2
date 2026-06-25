import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { getMembership } from "@/lib/classAccess";

// Toggle like for the current user on a post.
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const post = await prisma.post.findUnique({ where: { id: params.id } });
  if (!post) return NextResponse.json({ error: "Beitrag nicht gefunden." }, { status: 404 });

  const membership = await getMembership(userId, post.classId);
  if (!membership) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });

  const existing = await prisma.like.findUnique({
    where: { postId_userId: { postId: params.id, userId } },
  });

  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
  } else {
    await prisma.like.create({ data: { postId: params.id, userId } });
  }

  const likeCount = await prisma.like.count({ where: { postId: params.id } });
  return NextResponse.json({ liked: !existing, likeCount });
}
