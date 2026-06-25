import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { generateJoinCode } from "@/lib/classAccess";

// List all classes the current user is a member of.
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: {
      class: {
        include: { _count: { select: { memberships: true, posts: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const classes = memberships.map((m) => ({
    id: m.class.id,
    name: m.class.name,
    description: m.class.description,
    joinCode: m.class.joinCode,
    role: m.role,
    memberType: m.memberType,
    memberCount: m.class._count.memberships,
    postCount: m.class._count.posts,
  }));

  return NextResponse.json({ classes });
}

// Create a new class; creator becomes OWNER.
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const { name, description, school, gradYear, memberType, displayName } = await req
    .json()
    .catch(() => ({}));

  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: "Name der Klasse fehlt." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const joinCode = await generateJoinCode();
  const created = await prisma.class.create({
    data: {
      name: String(name).trim(),
      description: description ? String(description).trim() : null,
      school: school ? String(school).trim() : null,
      gradYear: gradYear ? String(gradYear).trim() : null,
      joinCode,
      ownerId: userId,
      memberships: {
        create: {
          userId,
          role: "OWNER",
          memberType: memberType === "TEACHER" ? "TEACHER" : "STUDENT",
          displayName: (displayName && String(displayName).trim()) || user.name,
        },
      },
    },
  });

  return NextResponse.json({ id: created.id, joinCode: created.joinCode });
}
