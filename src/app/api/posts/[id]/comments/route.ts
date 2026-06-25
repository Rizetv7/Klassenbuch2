import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { getMembership } from "@/lib/classAccess";

// List comments for a post.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const post = await prisma.post.findUnique({ where: { id: params.id } });
  if (!post) return NextResponse.json({ error: "Beitrag nicht gefunden." }, { status: 404 });

  const membership = await getMembership(userId, post.classId);
  if (!membership) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });

  const comments = await prisma.comment.findMany({
    where: { postId: params.id },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ comments });
}

// Add a comment.
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const post = await prisma.post.findUnique({ where: { id: params.id } });
  if (!post) return NextResponse.json({ error: "Beitrag nicht gefunden." }, { status: 404 });

  const membership = await getMembership(userId, post.classId);
  if (!membership) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });

  const { text } = await req.json().catch(() => ({}));
  if (!text || !String(text).trim()) {
    return NextResponse.json({ error: "Kommentar ist leer." }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: { postId: params.id, authorId: userId, text: String(text).trim() },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  });

  return NextResponse.json({ comment });
}
