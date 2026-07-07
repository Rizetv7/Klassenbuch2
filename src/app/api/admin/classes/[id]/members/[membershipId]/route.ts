import { NextResponse } from "next/server";
import { hasAdminSession, isSameOrigin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { MemberManagementError, restoreMembership } from "@/lib/memberManagement";

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
      aminaMode: true,
      leftAt: true,
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

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; membershipId: string } },
) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 403 });
  }

  const target = await prisma.membership.findFirst({
    where: { id: params.membershipId, classId: params.id },
  });
  if (!target) return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  const body = await req.json().catch(() => ({}));

  if (body.restore === true) {
    try {
      const restored = await restoreMembership(params.id, params.membershipId);
      return NextResponse.json({ membership: restored, restored: true });
    } catch (error) {
      if (error instanceof MemberManagementError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
  if (target.leftAt) {
    return NextResponse.json({ error: "Die Person muss zuerst wiederhergestellt werden." }, { status: 409 });
  }

  const data: { role?: string; memberType?: string; aminaMode?: boolean } = {};
  if (body.role === "MEMBER" || body.role === "MODERATOR") data.role = body.role;
  if (body.memberType === "STUDENT" || body.memberType === "TEACHER") data.memberType = body.memberType;
  if (typeof body.aminaMode === "boolean") data.aminaMode = body.aminaMode;
  if (target.role === "OWNER" && data.role) {
    return NextResponse.json({ error: "Die Klassenleitung kann nicht herabgestuft werden." }, { status: 400 });
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Keine Änderung angegeben." }, { status: 400 });
  }

  const updated = await prisma.membership.update({ where: { id: target.id }, data });
  return NextResponse.json({ membership: updated });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; membershipId: string } },
) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 403 });
  }

  const target = await prisma.membership.findFirst({
    where: { id: params.membershipId, classId: params.id },
  });
  if (!target) return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
  if (target.role === "OWNER") {
    return NextResponse.json({ error: "Die Klassenleitung kann nicht entfernt werden." }, { status: 400 });
  }
  await prisma.membership.update({
    where: { id: target.id },
    data: { leftAt: new Date(), aminaMode: false, role: "MEMBER" },
  });
  return NextResponse.json({ ok: true, deactivated: true });
}
