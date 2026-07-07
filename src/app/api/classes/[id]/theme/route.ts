import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { canModerate, getMembership } from "@/lib/classAccess";
import { isSameOrigin } from "@/lib/adminAuth";
import { ensureThemeSchema } from "@/lib/themeSchema";
import { isThemeId } from "@/lib/themes";

// Change the class theme (moderators and owners).
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 403 });
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const membership = await getMembership(userId, params.id);
  if (!membership || !canModerate(membership.role)) {
    return NextResponse.json({ error: "Nur Moderator:innen können das Design der Klasse ändern." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const theme = body.theme;
  if (!isThemeId(theme)) {
    return NextResponse.json({ error: "Unbekanntes Design." }, { status: 400 });
  }

  await ensureThemeSchema();
  await prisma.class.update({ where: { id: params.id }, data: { theme } });

  return NextResponse.json({ ok: true, theme });
}
