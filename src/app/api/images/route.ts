import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { postInclude, serializePostRows } from "@/lib/serializePost";

export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 32, 12), 48);
  const cursor = url.searchParams.get("cursor");

  const memberships = await prisma.membership.findMany({
    where: { userId, leftAt: null, class: { archivedAt: null } },
    select: { classId: true },
  });
  const classIds = memberships.map((membership) => membership.classId);
  if (classIds.length === 0) return NextResponse.json({ posts: [], nextCursor: null });

  const where: Prisma.PostWhereInput = {
    classId: { in: classIds },
    imageUrl: { not: null },
  };

  const cursorExists = cursor
    ? await prisma.post.findFirst({
        where: { ...where, id: cursor },
        select: { id: true },
      })
    : null;

  const rows = await prisma.post.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursorExists ? { cursor: { id: cursorExists.id }, skip: 1 } : {}),
    include: postInclude(userId),
  });

  const page = rows.slice(0, limit);
  const posts = await serializePostRows(page, userId);

  return NextResponse.json({
    posts,
    nextCursor: rows.length > limit ? page[page.length - 1]?.id ?? null : null,
  });
}
