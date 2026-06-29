import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const [classes, users] = await Promise.all([
    prisma.class.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        school: true,
        gradYear: true,
        joinCode: true,
        createdAt: true,
        owner: {
          select: { id: true, name: true, avatarUrl: true, accentColor: true },
        },
        _count: {
          select: {
            memberships: true,
            posts: true,
            polls: true,
            teachers: true,
            topics: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        accentColor: true,
        createdAt: true,
        memberships: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            memberType: true,
            class: { select: { id: true, name: true } },
          },
        },
        _count: { select: { posts: true, comments: true, polls: true } },
      },
    }),
  ]);

  const stats = {
    classes: classes.length,
    users: users.length,
    posts: classes.reduce((sum, item) => sum + item._count.posts, 0),
    polls: classes.reduce((sum, item) => sum + item._count.polls, 0),
  };

  return NextResponse.json(
    { stats, classes, users },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
