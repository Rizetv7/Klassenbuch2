import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { generateJoinCode, getMembership } from "@/lib/classAccess";
import { firstImageBySubject } from "@/lib/effectiveAvatar";
import { isSameOrigin } from "@/lib/adminAuth";
import { archiveClass } from "@/lib/classManagement";

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
  const activeMemberships = klass.memberships.filter((item) => item.leftAt === null);
  const inactiveMemberships = klass.memberships.filter((item) => item.leftAt !== null);
  const fallbackImg = await firstImageBySubject(
    activeMemberships.filter((m) => !m.user.avatarUrl).map((m) => m.id),
  );
  const mapMember = (m: (typeof klass.memberships)[number]) => ({
    id: m.id,
    // The shown name always follows the current account name, so a profile
    // rename is reflected everywhere (displayName is only a stale snapshot).
    displayName: m.user.name ?? m.displayName,
    memberType: m.memberType,
    role: m.role,
    aminaMode: m.aminaMode,
    leftAt: m.leftAt,
    avatarUrl: m.user.avatarUrl ?? fallbackImg.get(m.id) ?? null,
    manualAvatarUrl: m.user.avatarUrl,
    accentColor: m.user.accentColor,
    postCount: m._count.subjectPosts,
  });
  const members = activeMemberships.map(mapMember);
  const inactiveMembers = membership.role === "OWNER" ? inactiveMemberships.map(mapMember) : [];

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
    inactiveMembers,
  });
}

// Update class metadata or rotate the join code (owner only).
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 403 });
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  const membership = await getMembership(userId, params.id);
  if (!membership || membership.role !== "OWNER") {
    return NextResponse.json({ error: "Nur die Ersteller:in kann Klasseneinstellungen ändern." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
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

  const klass = await prisma.class.update({ where: { id: params.id }, data });
  return NextResponse.json({ class: klass });
}

// Archive a class instead of deleting it. All related content remains intact.
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 403 });
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const membership = await getMembership(userId, params.id);
  if (!membership || membership.role !== "OWNER") {
    return NextResponse.json({ error: "Nur die Ersteller:in kann die Klasse archivieren." }, { status: 403 });
  }

  const klass = await prisma.class.findUnique({ where: { id: params.id }, select: { name: true, archivedAt: true } });
  if (!klass) return NextResponse.json({ error: "Klasse nicht gefunden." }, { status: 404 });
  const { confirmation } = await req.json().catch(() => ({}));
  if (confirmation !== klass.name) {
    return NextResponse.json({ error: "Bitte den Klassennamen exakt bestätigen." }, { status: 400 });
  }
  if (!klass.archivedAt) {
    await archiveClass(params.id);
  }
  return NextResponse.json({ ok: true, archived: true });
}
