import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { getMembership } from "@/lib/classAccess";

// List projects/topics in a class.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const membership = await getMembership(userId, params.id);
  if (!membership) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });

  const topics = await prisma.topic.findMany({
    where: { classId: params.id },
    include: {
      _count: { select: { posts: true } },
      posts: {
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { kind: true, imageUrl: true, text: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    topics: topics.map((t) => ({
      id: t.id,
      name: t.name,
      postCount: t._count.posts,
      coverImageUrl: t.posts.find((p) => p.kind === "IMAGE" && p.imageUrl)?.imageUrl ?? null,
      latestText: t.posts.find((p) => p.text)?.text ?? null,
    })),
  });
}

// Create a project/topic (any member can).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const membership = await getMembership(userId, params.id);
  if (!membership) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });

  const { name } = await req.json().catch(() => ({}));
  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: "Name des Projekts fehlt." }, { status: 400 });
  }

  const topic = await prisma.topic.create({
    data: { classId: params.id, name: String(name).trim(), createdById: userId },
  });
  return NextResponse.json({ id: topic.id, name: topic.name });
}
