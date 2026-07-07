import { NextResponse } from "next/server";
import { hasAdminSession, isSameOrigin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { generateJoinCode } from "@/lib/classAccess";
import { archiveClass, restoreArchivedClass } from "@/lib/classManagement";
import { MemberManagementError } from "@/lib/memberManagement";

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
        archivedAt: true,
        owner: {
          select: { id: true, name: true, avatarUrl: true, accentColor: true },
        },
        _count: {
          select: {
            memberships: { where: { leftAt: null } },
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
        aminaMode: true,
        leftAt: true,
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

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const klass = await prisma.class.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, archivedAt: true },
  });
  if (!klass) return NextResponse.json({ error: "Klasse nicht gefunden." }, { status: 404 });

  if (body.action === "archive") {
    if (body.confirmation !== klass.name) {
      return NextResponse.json({ error: "Bitte den Klassennamen exakt bestätigen." }, { status: 400 });
    }
    if (!klass.archivedAt) await archiveClass(params.id);
    return NextResponse.json({ ok: true, archived: true });
  }
  if (body.action === "restore") {
    try {
      const result = await restoreArchivedClass(params.id);
      return NextResponse.json({ ok: true, restored: true, ...result });
    } catch (error) {
      if (error instanceof MemberManagementError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }

  const data: { name?: string; description?: string | null; school?: string | null; gradYear?: string | null; joinCode?: string } = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (name.length < 2 || name.length > 80) {
      return NextResponse.json({ error: "Der Klassenname muss 2 bis 80 Zeichen lang sein." }, { status: 400 });
    }
    data.name = name;
  }
  for (const field of ["description", "school", "gradYear"] as const) {
    if (typeof body[field] === "string" || body[field] === null) {
      const value = typeof body[field] === "string" ? body[field].trim() : "";
      data[field] = value ? value.slice(0, field === "description" ? 500 : 100) : null;
    }
  }
  if (body.regenerateJoinCode === true) data.joinCode = await generateJoinCode();
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Keine Änderung angegeben." }, { status: 400 });
  }

  const updated = await prisma.class.update({ where: { id: params.id }, data });
  return NextResponse.json({ class: updated });
}
