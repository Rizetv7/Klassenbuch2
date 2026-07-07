import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { isSameOrigin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 403 });
  }

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const memberships = await prisma.membership.findMany({
    where: { userId, leftAt: null, class: { archivedAt: null } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const membership = memberships[0];

  if (memberships.length === 0) {
    return NextResponse.json({ error: "Du bist noch in keiner Klasse." }, { status: 409 });
  }
  const updated = await prisma.membership.updateMany({
    where: { id: membership.id, userId, leftAt: null },
    data: { aminaMode: true },
  });
  if (updated.count !== 1) {
    return NextResponse.json({ error: "Der Amina-Modus konnte nicht aktiviert werden." }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 403 });
  }

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  await prisma.membership.updateMany({
    where: { userId, aminaMode: true, leftAt: null, class: { archivedAt: null } },
    data: { aminaMode: false },
  });
  return NextResponse.json({ ok: true });
}
