import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { getMembership } from "@/lib/classAccess";
import { serializePosts } from "@/lib/serializePost";

// GET /api/posts
//   ?classId=...            -> posts in a class
//   &board=YEARBOOK|POSTIT  -> filter by board
//   &subjectMembershipId=.. -> a single person's page
//   (no classId)            -> personal feed across all my classes
export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const url = new URL(req.url);
  const classId = url.searchParams.get("classId");
  const board = url.searchParams.get("board");
  const kind = url.searchParams.get("kind");
  const sort = url.searchParams.get("sort"); // "popular" | "recent"
  const random = url.searchParams.get("random"); // "1" -> a single random post
  const subjectMembershipId = url.searchParams.get("subjectMembershipId");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 30, 100);

  const where: Record<string, unknown> = {};

  if (classId) {
    const membership = await getMembership(userId, classId);
    if (!membership) {
      return NextResponse.json({ error: "Du bist kein Mitglied dieser Klasse." }, { status: 403 });
    }
    where.classId = classId;
  } else {
    // feed: only classes the viewer belongs to
    const memberships = await prisma.membership.findMany({
      where: { userId },
      select: { classId: true },
    });
    where.classId = { in: memberships.map((m) => m.classId) };
  }

  if (board === "YEARBOOK" || board === "POSTIT") where.board = board;
  if (kind === "QUOTE" || kind === "IMAGE" || kind === "TEXT") where.kind = kind;
  if (subjectMembershipId) where.subjectMembershipId = subjectMembershipId;

  // Random "memory of the day": pick one random matching post.
  if (random === "1") {
    const ids = await prisma.post.findMany({ where, select: { id: true }, take: 200 });
    if (ids.length === 0) return NextResponse.json({ posts: [] });
    const pick = ids[Math.floor(Math.random() * ids.length)].id;
    const posts = await serializePosts([pick], userId);
    return NextResponse.json({ posts });
  }

  const orderBy =
    sort === "popular"
      ? [{ likes: { _count: "desc" as const } }, { createdAt: "desc" as const }]
      : [{ createdAt: "desc" as const }];

  const rows = await prisma.post.findMany({
    where,
    orderBy,
    take: limit,
    select: { id: true },
  });

  const posts = await serializePosts(rows.map((r) => r.id), userId);
  return NextResponse.json({ posts });
}

// POST /api/posts  -> create a quote / image / post-it
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { classId, board, kind, text, context, imageUrl, subjectMembershipId } = body;

  if (!classId) return NextResponse.json({ error: "classId fehlt." }, { status: 400 });

  const membership = await getMembership(userId, classId);
  if (!membership) {
    return NextResponse.json({ error: "Du bist kein Mitglied dieser Klasse." }, { status: 403 });
  }

  const boardValue = board === "POSTIT" ? "POSTIT" : "YEARBOOK";
  const kindValue = ["QUOTE", "IMAGE", "TEXT"].includes(kind) ? kind : "QUOTE";

  if (kindValue === "IMAGE" && !imageUrl) {
    return NextResponse.json({ error: "Bild fehlt." }, { status: 400 });
  }
  if (kindValue !== "IMAGE" && (!text || !String(text).trim())) {
    return NextResponse.json({ error: "Text fehlt." }, { status: 400 });
  }

  // Yearbook posts must target a member of this class.
  let subjectId: string | null = null;
  if (boardValue === "YEARBOOK") {
    if (!subjectMembershipId) {
      return NextResponse.json({ error: "Bitte eine Person auswählen." }, { status: 400 });
    }
    const subject = await prisma.membership.findUnique({ where: { id: subjectMembershipId } });
    if (!subject || subject.classId !== classId) {
      return NextResponse.json({ error: "Ausgewählte Person gehört nicht zur Klasse." }, { status: 400 });
    }
    subjectId = subject.id;
  }

  const post = await prisma.post.create({
    data: {
      classId,
      authorId: userId,
      board: boardValue,
      kind: kindValue,
      text: text ? String(text).trim() : null,
      context: context ? String(context).trim() : null,
      imageUrl: imageUrl || null,
      subjectMembershipId: subjectId,
    },
  });

  const [serialized] = await serializePosts([post.id], userId);
  return NextResponse.json({ post: serialized });
}
