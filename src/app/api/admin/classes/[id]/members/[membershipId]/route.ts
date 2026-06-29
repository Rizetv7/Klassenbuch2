import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: { id: string; membershipId: string } },
) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const member = await prisma.membership.findFirst({
    where: { id: params.membershipId, classId: params.id },
    select: {
      id: true,
      role: true,
      memberType: true,
      displayName: true,
      createdAt: true,
      class: {
        select: { id: true, name: true, school: true, gradYear: true },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          accentColor: true,
          createdAt: true,
          _count: { select: { posts: true, comments: true, polls: true } },
        },
      },
    },
  });

  if (!member) {
    return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  }

  const posts = await prisma.post.findMany({
    where: {
      classId: params.id,
      OR: [
        { subjectMembershipId: params.membershipId },
        { authorId: member.user.id },
      ],
    },
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
  });

  return NextResponse.json(
    {
      member,
      aboutPosts: posts.filter((post) => post.subject?.id === params.membershipId),
      authoredPosts: posts.filter((post) => post.author.id === member.user.id),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
