import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { ensureImportSchema } from "@/lib/importSchema";

type ClassMetricRow = {
  classId: string;
  posts: bigint;
  quotes: bigint;
  notes: bigint;
  images: bigint;
  anonymousPosts: bigint;
  comments: bigint;
  likes: bigint;
  pollVotes: bigint;
  lastActivityAt: Date;
};

type UserActivityRow = { userId: string; lastActivityAt: Date | null };
type DailyRow = { day: Date; posts: bigint; comments: bigint; polls: bigint; votes: bigint };

function count(value: bigint | number | null | undefined) {
  return Number(value ?? 0);
}

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  await ensureImportSchema();

  const [
    classes,
    users,
    classMetrics,
    userActivity,
    dailyRows,
    recentPosts,
    recentPolls,
    recentComments,
    recentImports,
    recentMembers,
  ] = await Promise.all([
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
            importBatches: true,
            importItems: true,
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
            aminaMode: true,
            leftAt: true,
            class: { select: { id: true, name: true } },
          },
        },
        _count: { select: { posts: true, comments: true, polls: true, pollVotes: true } },
      },
    }),
    prisma.$queryRaw<ClassMetricRow[]>`
      SELECT
        c."id" AS "classId",
        (SELECT COUNT(*) FROM "Post" p WHERE p."classId" = c."id") AS posts,
        (SELECT COUNT(*) FROM "Post" p WHERE p."classId" = c."id" AND p."kind" = 'QUOTE') AS quotes,
        (SELECT COUNT(*) FROM "Post" p WHERE p."classId" = c."id" AND p."kind" = 'TEXT') AS notes,
        (SELECT COUNT(*) FROM "Post" p WHERE p."classId" = c."id" AND p."kind" = 'IMAGE') AS images,
        (SELECT COUNT(*) FROM "Post" p WHERE p."classId" = c."id" AND p."anonymous" = true) AS "anonymousPosts",
        (
          SELECT COUNT(*) FROM "Comment" cm
          LEFT JOIN "Post" cp ON cp."id" = cm."postId"
          LEFT JOIN "Poll" cl ON cl."id" = cm."pollId"
          WHERE COALESCE(cp."classId", cl."classId") = c."id"
        ) AS comments,
        (
          SELECT COUNT(*) FROM "Like" l
          JOIN "Post" lp ON lp."id" = l."postId"
          WHERE lp."classId" = c."id"
        ) AS likes,
        (
          SELECT COUNT(*) FROM "PollVote" pv
          JOIN "Poll" pp ON pp."id" = pv."pollId"
          WHERE pp."classId" = c."id"
        ) AS "pollVotes",
        GREATEST(
          c."createdAt",
          COALESCE((SELECT MAX(p."createdAt") FROM "Post" p WHERE p."classId" = c."id"), c."createdAt"),
          COALESCE((SELECT MAX(p."createdAt") FROM "Poll" p WHERE p."classId" = c."id"), c."createdAt"),
          COALESCE((SELECT MAX(m."createdAt") FROM "Membership" m WHERE m."classId" = c."id"), c."createdAt"),
          COALESCE((SELECT MAX(i."createdAt") FROM "ImportBatch" i WHERE i."classId" = c."id"), c."createdAt")
        ) AS "lastActivityAt"
      FROM "Class" c
    `,
    prisma.$queryRaw<UserActivityRow[]>`
      SELECT
        u."id" AS "userId",
        GREATEST(
          (SELECT MAX(p."createdAt") FROM "Post" p WHERE p."authorId" = u."id"),
          (SELECT MAX(c."createdAt") FROM "Comment" c WHERE c."authorId" = u."id"),
          (SELECT MAX(p."createdAt") FROM "Poll" p WHERE p."authorId" = u."id"),
          (SELECT MAX(v."createdAt") FROM "PollVote" v WHERE v."userId" = u."id")
        ) AS "lastActivityAt"
      FROM "User" u
    `,
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
        (SELECT COUNT(*) FROM "Post" p WHERE p."createdAt"::DATE = days.day) AS posts,
        (SELECT COUNT(*) FROM "Comment" c WHERE c."createdAt"::DATE = days.day) AS comments,
        (SELECT COUNT(*) FROM "Poll" p WHERE p."createdAt"::DATE = days.day) AS polls,
        (SELECT COUNT(*) FROM "PollVote" v WHERE v."createdAt"::DATE = days.day) AS votes
      FROM days
      ORDER BY days.day ASC
    `,
    prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        kind: true,
        text: true,
        anonymous: true,
        createdAt: true,
        class: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
      },
    }),
    prisma.poll.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        question: true,
        createdAt: true,
        class: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
      },
    }),
    prisma.comment.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        text: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
        post: { select: { class: { select: { id: true, name: true } } } },
        poll: { select: { class: { select: { id: true, name: true } } } },
      },
    }),
    prisma.importBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        itemCount: true,
        sourceType: true,
        createdAt: true,
        class: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
      },
    }),
    prisma.membership.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        role: true,
        createdAt: true,
        class: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    }),
  ]);

  const metricByClass = new Map(classMetrics.map((metric) => [metric.classId, metric]));
  const activityByUser = new Map(userActivity.map((activity) => [activity.userId, activity.lastActivityAt]));
  const enrichedClasses = classes.map((klass) => {
    const metric = metricByClass.get(klass.id);
    return {
      ...klass,
      insights: {
        quotes: count(metric?.quotes),
        notes: count(metric?.notes),
        images: count(metric?.images),
        anonymousPosts: count(metric?.anonymousPosts),
        comments: count(metric?.comments),
        likes: count(metric?.likes),
        pollVotes: count(metric?.pollVotes),
        lastActivityAt: metric?.lastActivityAt ?? klass.createdAt,
      },
    };
  });
  const enrichedUsers = users.map((user) => ({
    ...user,
    lastActivityAt: activityByUser.get(user.id) ?? null,
  }));

  const recentActivity = [
    ...recentPosts.map((post) => ({
      id: `post:${post.id}`,
      type: "POST",
      at: post.createdAt,
      class: post.class,
      person: post.author,
      title: post.kind === "IMAGE" ? "Bild veröffentlicht" : post.kind === "QUOTE" ? "Zitat veröffentlicht" : "Notiz veröffentlicht",
      detail: post.text?.slice(0, 120) || (post.anonymous ? "Anonym veröffentlicht" : null),
    })),
    ...recentPolls.map((poll) => ({
      id: `poll:${poll.id}`,
      type: "POLL",
      at: poll.createdAt,
      class: poll.class,
      person: poll.author,
      title: "Umfrage erstellt",
      detail: poll.question.slice(0, 120),
    })),
    ...recentComments.map((comment) => ({
      id: `comment:${comment.id}`,
      type: "COMMENT",
      at: comment.createdAt,
      class: comment.post?.class || comment.poll?.class || null,
      person: comment.author,
      title: "Kommentar geschrieben",
      detail: comment.text?.slice(0, 120) || "Bildkommentar",
    })),
    ...recentImports.map((batch) => ({
      id: `import:${batch.id}`,
      type: "IMPORT",
      at: batch.createdAt,
      class: batch.class,
      person: batch.creator,
      title: batch.sourceType === "LEGACY_DETECTED" ? "Früherer Import erkannt" : "Daten importiert",
      detail: `${batch.itemCount} Einträge`,
    })),
    ...recentMembers.map((membership) => ({
      id: `member:${membership.id}`,
      type: "MEMBER",
      at: membership.createdAt,
      class: membership.class,
      person: membership.user,
      title: "Person beigetreten",
      detail: membership.role,
    })),
  ]
    .filter((event) => event.class)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 18);

  const stats = {
    classes: classes.length,
    activeClasses: classes.filter((klass) => !klass.archivedAt).length,
    users: users.length,
    activeMemberships: classes.reduce((sum, klass) => sum + klass._count.memberships, 0),
    posts: classMetrics.reduce((sum, metric) => sum + count(metric.posts), 0),
    quotes: classMetrics.reduce((sum, metric) => sum + count(metric.quotes), 0),
    notes: classMetrics.reduce((sum, metric) => sum + count(metric.notes), 0),
    images: classMetrics.reduce((sum, metric) => sum + count(metric.images), 0),
    anonymousPosts: classMetrics.reduce((sum, metric) => sum + count(metric.anonymousPosts), 0),
    comments: classMetrics.reduce((sum, metric) => sum + count(metric.comments), 0),
    likes: classMetrics.reduce((sum, metric) => sum + count(metric.likes), 0),
    polls: classes.reduce((sum, klass) => sum + klass._count.polls, 0),
    pollVotes: classMetrics.reduce((sum, metric) => sum + count(metric.pollVotes), 0),
    importBatches: classes.reduce((sum, klass) => sum + klass._count.importBatches, 0),
    pendingImports: classes.reduce((sum, klass) => sum + klass._count.importItems, 0),
  };

  return NextResponse.json(
    {
      stats,
      classes: enrichedClasses,
      users: enrichedUsers,
      recentActivity,
      dailyActivity: dailyRows.map((row) => ({
        day: row.day,
        posts: count(row.posts),
        comments: count(row.comments),
        polls: count(row.polls),
        votes: count(row.votes),
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
