import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { getMembership, canModerate } from "@/lib/classAccess";

// Moderate a member: change role (promote to MODERATOR) or memberType.
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; membershipId: string } }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const me = await getMembership(userId, params.id);
  if (!me || !canModerate(me.role)) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const target = await prisma.membership.findUnique({ where: { id: params.membershipId } });
  if (!target || target.classId !== params.id) {
    return NextResponse.json({ error: "Mitglied nicht gefunden." }, { status: 404 });
  }
  if (target.role === "OWNER") {
    return NextResponse.json({ error: "Die Ersteller:in kann nicht verändert werden." }, { status: 400 });
  }

  const { role, memberType } = await req.json().catch(() => ({}));
  const data: { role?: string; memberType?: string } = {};
  if (role === "MODERATOR" || role === "MEMBER") data.role = role;
  if (memberType === "STUDENT" || memberType === "TEACHER") data.memberType = memberType;

  const updated = await prisma.membership.update({
    where: { id: params.membershipId },
    data,
  });
  return NextResponse.json({ id: updated.id, role: updated.role, memberType: updated.memberType });
}

// Remove a member from the class (moderators only; or remove yourself).
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; membershipId: string } }
) {
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

  await prisma.membership.delete({ where: { id: params.membershipId } });
  return NextResponse.json({ ok: true });
}
