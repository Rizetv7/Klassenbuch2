import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { getMembership } from "@/lib/classAccess";
import { sendPushToUsers } from "@/lib/push";

// like counts at which the author gets a push notification
const LIKE_MILESTONES = new Set([5, 10, 25, 50, 100]);

// Toggle like for the current user on a post.
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const post = await prisma.post.findUnique({ where: { id: params.id } });
  if (!post) return NextResponse.json({ error: "Beitrag nicht gefunden." }, { status: 404 });

  const membership = await getMembership(userId, post.classId);
  if (!membership) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });

  const existing = await prisma.like.findUnique({
    where: { postId_userId: { postId: params.id, userId } },
  });

  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
  } else {
    await prisma.like.create({ data: { postId: params.id, userId } });
  }

  const likeCount = await prisma.like.count({ where: { postId: params.id } });

  // Push: milestone reached (only on a NEW like, and not for self-likes)
  if (!existing && LIKE_MILESTONES.has(likeCount) && post.authorId !== userId) {
    const target = post.subjectMembershipId
      ? `/classes/${post.classId}/members/${post.subjectMembershipId}`
      : post.teacherId
        ? `/classes/${post.classId}/teachers/${post.teacherId}`
        : post.topicId
          ? `/classes/${post.classId}/topics/${post.topicId}`
          : "/";
    await sendPushToUsers([post.authorId], {
      title: `${likeCount} Likes! 🎉`,
      body: post.text
        ? `Dein Beitrag „${post.text.slice(0, 80)}“ kommt richtig gut an.`
        : "Dein Beitrag kommt richtig gut an.",
      url: target,
      tag: `likes-${post.id}`,
    });
  }

  return NextResponse.json({ liked: !existing, likeCount });
}
