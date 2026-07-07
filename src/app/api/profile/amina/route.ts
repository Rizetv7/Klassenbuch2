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
    select: { id: true, role: true },
  });
  const membership = memberships.find((entry) => entry.role !== "OWNER");

  if (memberships.length === 0) {
    return NextResponse.json({ error: "Du bist noch in keiner Klasse." }, { status: 409 });
  }
  if (!membership) {
    return NextResponse.json({ error: "Klassenleitungen können den Amina-Modus nur als Vorschau öffnen." }, { status: 403 });
  }

  const updated = await prisma.membership.updateMany({
    where: { id: membership.id, userId, leftAt: null, role: { not: "OWNER" } },
    data: { aminaMode: true },
  });
  if (updated.count !== 1) {
    return NextResponse.json({ error: "Der Amina-Modus konnte nicht aktiviert werden." }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
