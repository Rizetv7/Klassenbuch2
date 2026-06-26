import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { ensurePollSchema } from "@/lib/pollSchema";
import { pollInclude, serializePollRows } from "@/lib/serializePoll";
import { postInclude, serializePostRows } from "@/lib/serializePost";

function dailyIndex(seed: string, length: number) {
  if (length <= 0) return 0;
  const day = Math.floor(Date.now() / 86_400_000);
  let hash = day;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash % length;
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ user: null, hasClass: false, posts: [], memory: null, polls: [] });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      accentColor: true,
      memberships: { select: { classId: true, role: true } },
    },
  });
  if (!user) return NextResponse.json({ user: null, hasClass: false, posts: [], memory: null, polls: [] });

  const classIds = user.memberships.map((m) => m.classId);
  await ensurePollSchema();
  const [rows, pollRows] = classIds.length
    ? await Promise.all([
        prisma.post.findMany({
          where: { classId: { in: classIds } },
          orderBy: { createdAt: "desc" },
          take: 30,
          include: postInclude(userId),
        }),
        prisma.poll.findMany({
          where: { classId: { in: classIds } },
          orderBy: { createdAt: "desc" },
          take: 24,
          include: pollInclude(userId),
        }),
      ])
    : [[], []];

  const posts = serializePostRows(rows);
  const access = Object.fromEntries(user.memberships.map((m) => [m.classId, m.role]));
  const polls = serializePollRows(pollRows, userId, access).filter((poll) => !poll.votedByMe).slice(0, 6);
  const memoryPool = posts.filter((p) => p.imageUrl || p.kind === "QUOTE");
  const memory = memoryPool.length ? memoryPool[dailyIndex(userId, memoryPool.length)] : posts[0] ?? null;

  return NextResponse.json({
    user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl, accentColor: user.accentColor },
    hasClass: classIds.length > 0,
    posts,
    memory,
    polls,
  });
}
