import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { hasAdminSession, isSameOrigin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { ensureImportSchema } from "@/lib/importSchema";
import { generateJoinCode } from "@/lib/classAccess";
import { archiveClass, restoreArchivedClass } from "@/lib/classManagement";
import { MemberManagementError } from "@/lib/memberManagement";

type DailyRow = { day: Date; posts: bigint; comments: bigint; polls: bigint; votes: bigint };

function count(value: bigint | number | null | undefined) {
  return Number(value ?? 0);
}

function latestDate(...values: Array<Date | null | undefined>) {
  const timestamps = values.filter(Boolean).map((value) => (value as Date).getTime());
  return timestamps.length ? new Date(Math.max(...timestamps)) : null;
}

const adminPersonSelect = {
  id: true,
  name: true,
  avatarUrl: true,
  accentColor: true,
} as const;

async function getSummary(classId: string) {
  const [
    klass,
    members,
    teachers,
    topics,
    postGroups,
    commentCount,
    likeCount,
    voteCount,
    postContributors,
    commentContributors,
    pollContributors,
    voteContributors,
    dailyRows,
    recentPosts,
    recentComments,
    recentPolls,
    recentVotes,
    recentMembers,
    recentImports,
  ] = await Promise.all([
    prisma.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        name: true,
        description: true,
        school: true,
        gradYear: true,
        joinCode: true,
        createdAt: true,
        archivedAt: true,
        owner: { select: adminPersonSelect },
        _count: {
          select: {
            memberships: { where: { leftAt: null } },
            posts: true,
            polls: true,
            teachers: true,
            topics: true,
            importBatches: true,
            importItems: true,
          },
        },
      },
    }),
    prisma.membership.findMany({
      where: { classId },
      orderBy: [{ leftAt: "asc" }, { memberType: "asc" }, { displayName: "asc" }],
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
            ...adminPersonSelect,
            email: true,
            createdAt: true,
            _count: { select: { posts: true, comments: true, polls: true, pollVotes: true } },
          },
        },
        _count: { select: { subjectPosts: true } },
      },
    }),
    prisma.teacher.findMany({
      where: { classId },
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
      where: { classId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        creator: { select: { id: true, name: true } },
        _count: { select: { posts: true } },
      },
    }),
    prisma.post.groupBy({
      by: ["kind", "anonymous"],
      where: { classId },
      _count: { _all: true },
    }),
    prisma.comment.count({
      where: { OR: [{ post: { classId } }, { poll: { classId } }] },
    }),
    prisma.like.count({ where: { post: { classId } } }),
    prisma.pollVote.count({ where: { poll: { classId } } }),
    prisma.post.groupBy({
      by: ["authorId"],
      where: { classId },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.comment.groupBy({
      by: ["authorId"],
      where: { OR: [{ post: { classId } }, { poll: { classId } }] },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.poll.groupBy({
      by: ["authorId"],
      where: { classId },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.pollVote.groupBy({
      by: ["userId"],
      where: { poll: { classId } },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.$queryRaw<DailyRow[]>`
      WITH days AS (
        SELECT GENERATE_SERIES(
          CURRENT_DATE - INTERVAL '13 days',
          CURRENT_DATE,
          INTERVAL '1 day'
        )::DATE AS day
      )
      SELECT
        days.day,
        (SELECT COUNT(*) FROM "Post" p WHERE p."classId" = ${classId} AND p."createdAt"::DATE = days.day) AS posts,
        (
          SELECT COUNT(*) FROM "Comment" c
          LEFT JOIN "Post" cp ON cp."id" = c."postId"
          LEFT JOIN "Poll" cl ON cl."id" = c."pollId"
          WHERE COALESCE(cp."classId", cl."classId") = ${classId}
            AND c."createdAt"::DATE = days.day
        ) AS comments,
        (SELECT COUNT(*) FROM "Poll" p WHERE p."classId" = ${classId} AND p."createdAt"::DATE = days.day) AS polls,
        (
          SELECT COUNT(*) FROM "PollVote" v
          JOIN "Poll" p ON p."id" = v."pollId"
          WHERE p."classId" = ${classId} AND v."createdAt"::DATE = days.day
        ) AS votes
      FROM days
      ORDER BY days.day ASC
    `,
    prisma.post.findMany({
      where: { classId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        kind: true,
        text: true,
        anonymous: true,
        createdAt: true,
        author: { select: adminPersonSelect },
        subject: { select: { displayName: true } },
        teacher: { select: { name: true } },
        topic: { select: { name: true } },
      },
    }),
    prisma.comment.findMany({
      where: { OR: [{ post: { classId } }, { poll: { classId } }] },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        text: true,
        imageUrl: true,
        createdAt: true,
        author: { select: adminPersonSelect },
      },
    }),
    prisma.poll.findMany({
      where: { classId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        question: true,
        createdAt: true,
        author: { select: adminPersonSelect },
      },
    }),
    prisma.pollVote.findMany({
      where: { poll: { classId } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        createdAt: true,
        user: { select: adminPersonSelect },
        poll: { select: { question: true } },
      },
    }),
    prisma.membership.findMany({
      where: { classId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: { select: adminPersonSelect },
      },
    }),
    prisma.importBatch.findMany({
      where: { classId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        itemCount: true,
        sourceType: true,
        createdAt: true,
        creator: { select: adminPersonSelect },
      },
    }),
  ]);

  if (!klass) return null;

  const postByUser = new Map(postContributors.map((entry) => [entry.authorId, entry]));
  const commentByUser = new Map(commentContributors.map((entry) => [entry.authorId, entry]));
  const pollByUser = new Map(pollContributors.map((entry) => [entry.authorId, entry]));
  const voteByUser = new Map(voteContributors.map((entry) => [entry.userId, entry]));
  const enrichedMembers = members.map((member) => {
    const posts = postByUser.get(member.user.id);
    const comments = commentByUser.get(member.user.id);
    const polls = pollByUser.get(member.user.id);
    const votes = voteByUser.get(member.user.id);
    return {
      ...member,
      activity: {
        posts: posts?._count._all ?? 0,
        comments: comments?._count._all ?? 0,
        polls: polls?._count._all ?? 0,
        votes: votes?._count._all ?? 0,
        lastActivityAt: latestDate(
          posts?._max.createdAt,
          comments?._max.createdAt,
          polls?._max.createdAt,
          votes?._max.createdAt,
        ),
      },
    };
  });

  const content = {
    quotes: postGroups.filter((group) => group.kind === "QUOTE").reduce((sum, group) => sum + group._count._all, 0),
    notes: postGroups.filter((group) => group.kind === "TEXT").reduce((sum, group) => sum + group._count._all, 0),
    images: postGroups.filter((group) => group.kind === "IMAGE").reduce((sum, group) => sum + group._count._all, 0),
    anonymous: postGroups.filter((group) => group.anonymous).reduce((sum, group) => sum + group._count._all, 0),
  };
  const activeMembers = enrichedMembers.filter((member) => !member.leftAt);
  const stats = {
    activeMembers: activeMembers.length,
    formerMembers: enrichedMembers.length - activeMembers.length,
    moderators: activeMembers.filter((member) => member.role === "MODERATOR").length,
    aminaMode: activeMembers.filter((member) => member.aminaMode).length,
    posts: klass._count.posts,
    ...content,
    comments: commentCount,
    likes: likeCount,
    polls: klass._count.polls,
    pollVotes: voteCount,
    teachers: klass._count.teachers,
    topics: klass._count.topics,
    importBatches: klass._count.importBatches,
    pendingImports: klass._count.importItems,
  };

  const recentActivity = [
    ...recentPosts.map((post) => ({
      id: `post:${post.id}`,
      type: "POST",
      at: post.createdAt,
      person: post.author,
      title: post.kind === "IMAGE" ? "Bild veröffentlicht" : post.kind === "QUOTE" ? "Zitat veröffentlicht" : "Notiz veröffentlicht",
      detail: post.text?.slice(0, 120) || post.subject?.displayName || post.teacher?.name || post.topic?.name || null,
      private: post.anonymous,
    })),
    ...recentComments.map((comment) => ({
      id: `comment:${comment.id}`,
      type: "COMMENT",
      at: comment.createdAt,
      person: comment.author,
      title: "Kommentar geschrieben",
      detail: comment.text?.slice(0, 120) || (comment.imageUrl ? "Bildkommentar" : null),
      private: false,
    })),
    ...recentPolls.map((poll) => ({
      id: `poll:${poll.id}`,
      type: "POLL",
      at: poll.createdAt,
      person: poll.author,
      title: "Umfrage erstellt",
      detail: poll.question.slice(0, 120),
      private: false,
    })),
    ...recentVotes.map((vote) => ({
      id: `vote:${vote.id}`,
      type: "VOTE",
      at: vote.createdAt,
      person: vote.user,
      title: "In Umfrage abgestimmt",
      detail: vote.poll.question.slice(0, 120),
      private: false,
    })),
    ...recentMembers.map((membership) => ({
      id: `member:${membership.id}`,
      type: "MEMBER",
      at: membership.createdAt,
      person: membership.user,
      title: "Der Klasse beigetreten",
      detail: membership.role,
      private: false,
    })),
    ...recentImports.map((batch) => ({
      id: `import:${batch.id}`,
      type: "IMPORT",
      at: batch.createdAt,
      person: batch.creator,
      title: batch.sourceType === "LEGACY_DETECTED" ? "Früherer Import erkannt" : "Daten importiert",
      detail: `${batch.itemCount} Einträge`,
      private: false,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 20);

  const contributors = activeMembers
    .map((member) => ({
      membershipId: member.id,
      person: member.user,
      ...member.activity,
      total: member.activity.posts + member.activity.comments + member.activity.polls + member.activity.votes,
    }))
    .sort((a, b) => b.total - a.total || a.person.name.localeCompare(b.person.name))
    .slice(0, 8);

  return {
    class: klass,
    members: enrichedMembers,
    teachers,
    topics,
    stats,
    contributors,
    recentActivity,
    dailyActivity: dailyRows.map((row) => ({
      day: row.day,
      posts: count(row.posts),
      comments: count(row.comments),
      polls: count(row.polls),
      votes: count(row.votes),
    })),
  };
}

async function getPosts(req: Request, classId: string) {
  const url = new URL(req.url);
  const limit = Math.min(60, Math.max(12, Number(url.searchParams.get("limit")) || 30));
  const cursor = url.searchParams.get("cursor") || undefined;
  const query = url.searchParams.get("query")?.trim().slice(0, 120) || "";
  const kind = url.searchParams.get("kind");
  const privacy = url.searchParams.get("privacy");
  const imported = url.searchParams.get("imported");
  const where: Prisma.PostWhereInput = { classId };
  if (kind === "QUOTE" || kind === "TEXT" || kind === "IMAGE") where.kind = kind;
  if (privacy === "anonymous") where.anonymous = true;
  if (privacy === "named") where.anonymous = false;
  if (imported === "yes") where.importBatchId = { not: null };
  if (imported === "no") where.importBatchId = null;
  if (query) {
    where.OR = [
      { text: { contains: query, mode: "insensitive" } },
      { context: { contains: query, mode: "insensitive" } },
      { saidByName: { contains: query, mode: "insensitive" } },
      { author: { name: { contains: query, mode: "insensitive" } } },
      { subject: { displayName: { contains: query, mode: "insensitive" } } },
      { subject: { user: { name: { contains: query, mode: "insensitive" } } } },
      { teacher: { name: { contains: query, mode: "insensitive" } } },
      { topic: { name: { contains: query, mode: "insensitive" } } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.post.count({ where }),
    prisma.post.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
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
        author: { select: adminPersonSelect },
        subject: {
          select: {
            id: true,
            displayName: true,
            user: { select: adminPersonSelect },
          },
        },
        teacher: { select: adminPersonSelect },
        topic: { select: { id: true, name: true } },
        importBatch: { select: { id: true, sourceType: true, createdAt: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            text: true,
            parentId: true,
            createdAt: true,
            author: { select: adminPersonSelect },
          },
        },
        _count: { select: { likes: true, comments: true } },
      },
    }),
  ]);
  const hasMore = items.length > limit;
  if (hasMore) items.pop();
  return { posts: items, total, nextCursor: hasMore ? items.at(-1)?.id ?? null : null };
}

async function getPolls(classId: string) {
  const polls = await prisma.poll.findMany({
    where: { classId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      question: true,
      description: true,
      candidateType: true,
      anonymous: true,
      multipleChoice: true,
      createdAt: true,
      author: { select: adminPersonSelect },
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
              user: { select: adminPersonSelect },
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
          author: { select: adminPersonSelect },
        },
      },
    },
  });
  return {
    polls: polls.map((poll) => {
      const totalVoters = new Set(poll.options.flatMap((option) => option.votes.map((vote) => vote.user.id))).size;
      return {
        ...poll,
        totalVoters,
        options: poll.options.map((option) => ({
          ...option,
          percent: totalVoters > 0 ? Math.round((option.votes.length / totalVoters) * 100) : 0,
        })),
      };
    }),
  };
}

async function getImports(classId: string) {
  const batches = await prisma.importBatch.findMany({
    where: { classId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      sourceType: true,
      sourceText: true,
      itemCount: true,
      anonymizedAt: true,
      createdAt: true,
      creator: { select: adminPersonSelect },
      posts: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          kind: true,
          text: true,
          context: true,
          imageUrl: true,
          anonymous: true,
          createdAt: true,
          author: { select: adminPersonSelect },
          subject: { select: { id: true, displayName: true, user: { select: adminPersonSelect } } },
          teacher: { select: { id: true, name: true, avatarUrl: true, accentColor: true } },
        },
      },
      pendingItems: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          rawName: true,
          targetType: true,
          kind: true,
          text: true,
          context: true,
          imageUrl: true,
          createdAt: true,
        },
      },
    },
  });
  return {
    imports: batches.map((batch) => ({
      ...batch,
      matchedCount: batch.posts.length,
      pendingCount: batch.pendingItems.length,
      removedCount: Math.max(0, batch.itemCount - batch.posts.length - batch.pendingItems.length),
      anonymousCount: batch.posts.filter((post) => post.anonymous).length,
      allAnonymous: Boolean(batch.anonymizedAt),
      kinds: {
        quotes: batch.posts.filter((post) => post.kind === "QUOTE").length + batch.pendingItems.filter((item) => item.kind === "QUOTE").length,
        notes: batch.posts.filter((post) => post.kind === "TEXT").length + batch.pendingItems.filter((item) => item.kind === "TEXT").length,
        images: batch.posts.filter((post) => post.kind === "IMAGE").length + batch.pendingItems.filter((item) => item.kind === "IMAGE").length,
      },
    })),
  };
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }
  await ensureImportSchema();

  const section = new URL(req.url).searchParams.get("section") || "summary";
  if (section === "posts") {
    return NextResponse.json(await getPosts(req, params.id), { headers: { "Cache-Control": "private, no-store" } });
  }
  if (section === "polls") {
    return NextResponse.json(await getPolls(params.id), { headers: { "Cache-Control": "private, no-store" } });
  }
  if (section === "imports") {
    return NextResponse.json(await getImports(params.id), { headers: { "Cache-Control": "private, no-store" } });
  }

  const summary = await getSummary(params.id);
  if (!summary) return NextResponse.json({ error: "Klasse nicht gefunden." }, { status: 404 });
  return NextResponse.json(summary, { headers: { "Cache-Control": "private, no-store" } });
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
