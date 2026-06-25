import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";

// Join an existing class via its join code.
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const { joinCode, memberType, displayName } = await req.json().catch(() => ({}));
  if (!joinCode || !String(joinCode).trim()) {
    return NextResponse.json({ error: "Beitritts-Code fehlt." }, { status: 400 });
  }

  const code = String(joinCode).trim().toUpperCase();
  const klass = await prisma.class.findUnique({ where: { joinCode: code } });
  if (!klass) {
    return NextResponse.json({ error: "Keine Klasse mit diesem Code gefunden." }, { status: 404 });
  }

  // A user can be in at most one class.
  const anyMembership = await prisma.membership.findFirst({ where: { userId } });
  if (anyMembership) {
    if (anyMembership.classId === klass.id) {
      return NextResponse.json({ id: klass.id, alreadyMember: true });
    }
    return NextResponse.json(
      { error: "Du bist bereits in einer Klasse. Verlasse sie zuerst, um zu wechseln." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  await prisma.membership.create({
    data: {
      userId,
      classId: klass.id,
      role: "MEMBER",
      memberType: memberType === "TEACHER" ? "TEACHER" : "STUDENT",
      displayName: (displayName && String(displayName).trim()) || user.name,
    },
  });

  return NextResponse.json({ id: klass.id });
}
