import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { getMembership } from "@/lib/classAccess";
import { ensureCommentSchema } from "@/lib/commentSchema";

const COMMENT_SELECT = {
  id: true,
  text: true,
  parentId: true,
  createdAt: true,
  author: { select: { id: true, name: true, avatarUrl: true, accentColor: true } },
} as const;

// List comments for a post (flat list incl. parentId; the client builds the tree).
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  await ensureCommentSchema();

  const post = await prisma.post.findUnique({ where: { id: params.id } });
  if (!post) return NextResponse.json({ error: "Beitrag nicht gefunden." }, { status: 404 });

  const membership = await getMembership(userId, post.classId);
  if (!membership) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });

  const comments = await prisma.comment.findMany({
    where: { postId: params.id },
    select: COMMENT_SELECT,
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

  await ensureCommentSchema();

  const post = await prisma.post.findUnique({ where: { id: params.id } });
  if (!post) return NextResponse.json({ error: "Beitrag nicht gefunden." }, { status: 404 });

  const membership = await getMembership(userId, post.classId);
  if (!membership) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });

  const { text, parentId } = await req.json().catch(() => ({}));
  if (!text || !String(text).trim()) {
    return NextResponse.json({ error: "Kommentar ist leer." }, { status: 400 });
  }

  // A reply must point at a comment that belongs to this same post.
  let parent: string | null = null;
  if (parentId) {
    const parentComment = await prisma.comment.findUnique({ where: { id: String(parentId) } });
    if (!parentComment || parentComment.postId !== params.id) {
      return NextResponse.json({ error: "Antwort-Ziel ungültig." }, { status: 400 });
    }
    parent = parentComment.id;
  }

  const comment = await prisma.comment.create({
    data: { postId: params.id, authorId: userId, text: String(text).trim(), parentId: parent },
    select: COMMENT_SELECT,
  });

  return NextResponse.json({ comment });
}
