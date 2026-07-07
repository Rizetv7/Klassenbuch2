import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { getMembership, canModerate } from "@/lib/classAccess";
import { isSameOrigin } from "@/lib/adminAuth";
import { MemberManagementError, restoreMembership } from "@/lib/memberManagement";

// Moderate a member: change role (promote to MODERATOR) or memberType.
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; membershipId: string } }
) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 403 });
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const me = await getMembership(userId, params.id);
  if (!me) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const target = await prisma.membership.findUnique({ where: { id: params.membershipId } });
  if (!target || target.classId !== params.id) {
    return NextResponse.json({ error: "Mitglied nicht gefunden." }, { status: 404 });
  }

  const { role, memberType, avatarUrl, aminaMode, restore } = await req.json().catch(() => ({}));
  if (restore === true) {
    if (me.role !== "OWNER") {
      return NextResponse.json({ error: "Nur die Ersteller:in kann Personen wiederherstellen." }, { status: 403 });
    }
    try {
      const restored = await restoreMembership(params.id, params.membershipId);
      return NextResponse.json({ id: restored.id, restored: true, aminaMode: restored.aminaMode });
    } catch (error) {
      if (error instanceof MemberManagementError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }

  if (target.leftAt) {
    return NextResponse.json({ error: "Diese Person ist nicht mehr aktiv in der Klasse." }, { status: 409 });
  }

  const data: { role?: string; memberType?: string; aminaMode?: boolean } = {};
  if (role === "MODERATOR" || role === "MEMBER") data.role = role;
  if (memberType === "STUDENT" || memberType === "TEACHER") data.memberType = memberType;
  if (typeof aminaMode === "boolean") {
    if (me.role !== "OWNER") {
      return NextResponse.json({ error: "Nur die Ersteller:in kann den Amina-Modus ändern." }, { status: 403 });
    }
    if (target.role === "OWNER") {
      return NextResponse.json({ error: "Die Klassenleitung kann den Amina-Modus nicht erhalten." }, { status: 400 });
    }
    data.aminaMode = aminaMode;
  }

  if (Object.keys(data).length > 0) {
    if (!canModerate(me.role)) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
    if (target.role === "OWNER") {
      return NextResponse.json({ error: "Die Ersteller:in kann nicht verändert werden." }, { status: 400 });
    }
  }

  let nextAvatarUrl: string | null | undefined;
  if (typeof avatarUrl === "string" || avatarUrl === null) {
    const canEditAvatar = target.userId === userId || canModerate(me.role);
    if (!canEditAvatar) return NextResponse.json({ error: "Keine Berechtigung für dieses Profilbild." }, { status: 403 });
    const user = await prisma.user.update({
      where: { id: target.userId },
      data: { avatarUrl: typeof avatarUrl === "string" && avatarUrl.trim() ? avatarUrl.trim() : null },
      select: { avatarUrl: true },
    });
    nextAvatarUrl = user.avatarUrl;
  }

  const updated = Object.keys(data).length > 0
    ? await prisma.membership.update({ where: { id: params.membershipId }, data })
    : target;

  return NextResponse.json({
    id: updated.id,
    role: updated.role,
    memberType: updated.memberType,
    aminaMode: updated.aminaMode,
    avatarUrl: nextAvatarUrl,
  });
}

// Remove a member from the class (moderators only; or remove yourself).
export async function DELETE(
  req: Request,
  { params }: { params: { id: string; membershipId: string } }
) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 403 });
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const me = await getMembership(userId, params.id);
  if (!me) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });

  const target = await prisma.membership.findUnique({ where: { id: params.membershipId } });
  if (!target || target.classId !== params.id) {
    return NextResponse.json({ error: "Mitglied nicht gefunden." }, { status: 404 });
  }
  if (target.role === "OWNER") {
    return NextResponse.json({ error: "Die Ersteller:in kann nicht entfernt werden." }, { status: 400 });
  }

  const isSelf = target.userId === userId;
  if (!isSelf && !canModerate(me.role)) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  await prisma.membership.update({
    where: { id: params.membershipId },
    data: { leftAt: new Date(), aminaMode: false, role: "MEMBER" },
  });
  return NextResponse.json({ ok: true, deactivated: true });
}
