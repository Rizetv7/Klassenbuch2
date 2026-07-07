import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { getActiveMembership } from "@/lib/classAccess";
import { isSameOrigin } from "@/lib/adminAuth";

// Leave the current class. Owners must delete the class instead.
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 403 });
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const membership = await getActiveMembership(userId);
  if (!membership) return NextResponse.json({ ok: true });

  if (membership.role === "OWNER") {
    return NextResponse.json(
      { error: "Du hast diese Klasse erstellt. Du kannst sie nur unter Verwalten löschen." },
      { status: 400 }
    );
  }

  await prisma.membership.update({
    where: { id: membership.id },
    data: { leftAt: new Date(), aminaMode: false, role: "MEMBER" },
  });
  return NextResponse.json({ ok: true, deactivated: true });
}
