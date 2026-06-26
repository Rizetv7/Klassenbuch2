import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { getMembership } from "@/lib/classAccess";
import { firstImageBySubject } from "@/lib/effectiveAvatar";

// Class details incl. members (the auto-generated student/teacher list).
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const membership = await getMembership(userId, params.id);
  if (!membership) {
    return NextResponse.json({ error: "Du bist kein Mitglied dieser Klasse." }, { status: 403 });
  }

  const klass = await prisma.class.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { posts: true, teachers: true } },
      memberships: {
        include: {
          user: { select: { name: true, avatarUrl: true, accentColor: true } },
          _count: { select: { subjectPosts: true } },
        },
        orderBy: [{ memberType: "asc" }, { user: { name: "asc" } }],
      },
    },
  });
  if (!klass) return NextResponse.json({ error: "Klasse nicht gefunden." }, { status: 404 });

  // For members without a manually chosen avatar, fall back to the newest
  // image posted about them so the same picture shows everywhere.
  const fallbackImg = await firstImageBySubject(
    klass.memberships.filter((m) => !m.user.avatarUrl).map((m) => m.id),
  );
  const members = klass.memberships.map((m) => ({
    id: m.id,
    // The shown name always follows the current account name, so a profile
    // rename is reflected everywhere (displayName is only a stale snapshot).
    displayName: m.user.name ?? m.displayName,
    memberType: m.memberType,
    role: m.role,
    avatarUrl: m.user.avatarUrl ?? fallbackImg.get(m.id) ?? null,
    manualAvatarUrl: m.user.avatarUrl,
    accentColor: m.user.accentColor,
    postCount: m._count.subjectPosts,
  }));

  return NextResponse.json({
    id: klass.id,
    name: klass.name,
    description: klass.description,
    school: klass.school,
    gradYear: klass.gradYear,
    joinCode: klass.joinCode,
    myRole: membership.role,
    myMembershipId: membership.id,
    counts: {
      students: members.filter((m) => m.memberType === "STUDENT").length,
      teachers: klass._count.teachers,
      memories: klass._count.posts,
    },
    members,
  });
}

// Delete a class (owner only).
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const membership = await getMembership(userId, params.id);
  if (!membership || membership.role !== "OWNER") {
    return NextResponse.json({ error: "Nur die Ersteller:in kann die Klasse löschen." }, { status: 403 });
  }

  await prisma.class.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
