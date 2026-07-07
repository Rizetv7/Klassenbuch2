import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { getMembership } from "@/lib/classAccess";
import { ensureCommentSchema } from "@/lib/commentSchema";

const COMMENT_SELECT = {
  id: true,
  text: true,
  imageUrl: true,
  parentId: true,
  createdAt: true,
  author: { select: { id: true, name: true, avatarUrl: true, accentColor: true } },
} as const;

// List comments for a poll (flat list incl. parentId; client builds the tree).
export async function GET(_req: Request, { params }: { params: { pollId: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  await ensureCommentSchema();

  const poll = await prisma.poll.findUnique({ where: { id: params.pollId }, select: { classId: true } });
  if (!poll) return NextResponse.json({ error: "Umfrage nicht gefunden." }, { status: 404 });

  const membership = await getMembership(userId, poll.classId);
  if (!membership) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });

  const comments = await prisma.comment.findMany({
    where: { pollId: params.pollId },
    select: COMMENT_SELECT,
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ comments });
}

// Add a comment (or a reply) to a poll.
export async function POST(req: Request, { params }: { params: { pollId: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  await ensureCommentSchema();

  const poll = await prisma.poll.findUnique({ where: { id: params.pollId }, select: { classId: true } });
  if (!poll) return NextResponse.json({ error: "Umfrage nicht gefunden." }, { status: 404 });

  const membership = await getMembership(userId, poll.classId);
  if (!membership) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });

  const { text, parentId, imageUrl } = await req.json().catch(() => ({}));
  const cleanText = typeof text === "string" && text.trim() ? text.trim().slice(0, 4000) : null;
  const cleanImage = typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim().slice(0, 1200) : null;
  if (!cleanText && !cleanImage) {
    return NextResponse.json({ error: "Kommentar ist leer." }, { status: 400 });
  }

  // A reply must point at a comment that belongs to this same poll.
  let parent: string | null = null;
  if (parentId) {
    const parentComment = await prisma.comment.findUnique({ where: { id: String(parentId) } });
    if (!parentComment || parentComment.pollId !== params.pollId) {
      return NextResponse.json({ error: "Antwort-Ziel ungültig." }, { status: 400 });
    }
    parent = parentComment.id;
  }

  const comment = await prisma.comment.create({
    data: { pollId: params.pollId, authorId: userId, text: cleanText, imageUrl: cleanImage, parentId: parent },
    select: COMMENT_SELECT,
  });

  return NextResponse.json({ comment });
}
