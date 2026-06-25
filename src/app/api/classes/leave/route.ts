import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";

// Leave the current class. Owners must delete the class instead.
export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const membership = await prisma.membership.findFirst({ where: { userId } });
  if (!membership) return NextResponse.json({ ok: true });

  if (membership.role === "OWNER") {
    return NextResponse.json(
      { error: "Du hast diese Klasse erstellt. Du kannst sie nur unter Verwalten löschen." },
      { status: 400 }
    );
  }

  await prisma.membership.delete({ where: { id: membership.id } });
  return NextResponse.json({ ok: true });
}
