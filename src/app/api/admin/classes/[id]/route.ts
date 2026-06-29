import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const [klass, members, teachers, topics, posts, polls] = await Promise.all([
    prisma.class.findUnique({
      where: { id: params.id },
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
    prisma.membership.findMany({
      where: { classId: params.id },
      orderBy: [{ memberType: "asc" }, { displayName: "asc" }],
      select: {
        id: true,
        role: true,
        memberType: true,
        displayName: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            accentColor: true,
            _count: { select: { posts: true, comments: true, polls: true } },
          },
        },
        _count: { select: { subjectPosts: true } },
      },
    }),
    prisma.teacher.findMany({
      where: { classId: params.id },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        subject: true,
        avatarUrl: true,
        accentColor: true,
        createdAt: true,
        creator: { select: { id: true, name: true } },
        _count: { select: { posts: true } },
      },
    }),
    prisma.topic.findMany({
      where: { classId: params.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        creator: { select: { id: true, name: true } },
        _count: { select: { posts: true } },
      },
    }),
    prisma.post.findMany({
      where: { classId: params.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        board: true,
        kind: true,
        text: true,
        context: true,
        saidByName: true,
        anonymous: true,
        imageUrl: true,
        createdAt: true,
        author: {
          select: { id: true, name: true, avatarUrl: true, accentColor: true },
        },
        subject: {
          select: {
            id: true,
            displayName: true,
            user: {
              select: { id: true, name: true, avatarUrl: true, accentColor: true },
            },
          },
        },
        teacher: { select: { id: true, name: true, avatarUrl: true, accentColor: true } },
        topic: { select: { id: true, name: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            text: true,
            parentId: true,
            createdAt: true,
            author: {
              select: { id: true, name: true, avatarUrl: true, accentColor: true },
            },
          },
        },
        _count: { select: { likes: true, comments: true } },
      },
    }),
    prisma.poll.findMany({
      where: { classId: params.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        question: true,
        description: true,
        candidateType: true,
        anonymous: true,
        multipleChoice: true,
        createdAt: true,
        author: {
          select: { id: true, name: true, avatarUrl: true, accentColor: true },
        },
        options: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            text: true,
            position: true,
            votes: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                createdAt: true,
                user: {
                  select: { id: true, name: true, avatarUrl: true, accentColor: true },
                },
              },
            },
          },
        },
        comments: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            text: true,
            parentId: true,
            createdAt: true,
            author: {
              select: { id: true, name: true, avatarUrl: true, accentColor: true },
            },
          },
        },
      },
    }),
  ]);

  if (!klass) {
    return NextResponse.json({ error: "Klasse nicht gefunden." }, { status: 404 });
  }

  const serializedPolls = polls.map((poll) => {
    const voterIds = new Set(
      poll.options.flatMap((option) => option.votes.map((vote) => vote.user.id)),
    );
    const totalVoters = voterIds.size;
    return {
      ...poll,
      totalVoters,
      options: poll.options.map((option) => ({
        ...option,
        percent: totalVoters > 0 ? Math.round((option.votes.length / totalVoters) * 100) : 0,
      })),
    };
  });

  return NextResponse.json(
    { class: klass, members, teachers, topics, posts, polls: serializedPolls },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
