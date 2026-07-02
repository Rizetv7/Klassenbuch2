import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { getMembership } from "@/lib/classAccess";
import { ensurePollSchema } from "@/lib/pollSchema";
import { pollInclude, serializePollRows, serializePolls } from "@/lib/serializePoll";
import { sendPushToUsers } from "@/lib/push";

export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  await ensurePollSchema();

  const url = new URL(req.url);
  const classId = url.searchParams.get("classId");
  const pending = url.searchParams.get("pending") === "1";
  const limit = Math.min(Number(url.searchParams.get("limit")) || 40, 100);
  const where: Record<string, unknown> = {};

  let access: Record<string, string> = {};

  if (classId) {
    const membership = await getMembership(userId, classId);
    if (!membership) return NextResponse.json({ error: "Du bist kein Mitglied dieser Klasse." }, { status: 403 });
    where.classId = classId;
    access = { [classId]: membership.role };
  } else {
    const memberships = await prisma.membership.findMany({
      where: { userId },
      select: { classId: true, role: true },
    });
    const classIds = memberships.map((m) => m.classId);
    if (classIds.length === 0) return NextResponse.json({ polls: [] });
    where.classId = { in: classIds };
    access = Object.fromEntries(memberships.map((m) => [m.classId, m.role]));
  }

  const rows = await prisma.poll.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: pending ? Math.min(limit * 4, 100) : limit,
    include: pollInclude(userId),
  });

  let polls = serializePollRows(rows, userId, access);
  if (pending) polls = polls.filter((poll) => !poll.votedByMe).slice(0, limit);
  return NextResponse.json({ polls });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  await ensurePollSchema();

  const body = await req.json().catch(() => ({}));
  const classId = typeof body.classId === "string" ? body.classId : "";
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  const candidateType = body.candidateType === "STUDENTS" || body.candidateType === "TEACHERS" ? body.candidateType : null;
  const multipleChoice = !!body.multipleChoice;
  const anonymous = !!body.anonymous;
  const options = Array.isArray(body.options)
    ? body.options.map((option: unknown) => String(option).trim()).filter(Boolean).slice(0, 8)
    : [];

  if (!classId) return NextResponse.json({ error: "Klasse fehlt." }, { status: 400 });
  const membership = await getMembership(userId, classId);
  if (!membership) return NextResponse.json({ error: "Du bist kein Mitglied dieser Klasse." }, { status: 403 });
  if (question.length < 3) return NextResponse.json({ error: "Die Frage ist zu kurz." }, { status: 400 });
  if (!candidateType && options.length < 2) return NextResponse.json({ error: "Mindestens zwei Antworten sind nötig." }, { status: 400 });

  const poll = await prisma.poll.create({
    data: {
      classId,
      authorId: userId,
      question: question.slice(0, 180),
      description: description ? description.slice(0, 260) : null,
      candidateType,
      anonymous,
      multipleChoice,
      ...(candidateType
        ? {}
        : {
            options: {
              create: options.map((text: string, index: number) => ({
                text: text.slice(0, 120),
                position: index,
              })),
            },
          }),
    },
  });

  const [serialized] = await serializePolls([poll.id], userId);

  // Push: tell all other class members about the new poll.
  const members = await prisma.membership.findMany({
    where: { classId, userId: { not: userId } },
    select: { userId: true },
  });
  await sendPushToUsers(
    members.map((m) => m.userId),
    {
      title: "Neue Umfrage 🗳️",
      body: `„${poll.question}“ — jetzt abstimmen!`,
      url: "/polls",
      tag: `poll-${poll.id}`,
    }
  );

  return NextResponse.json({ poll: serialized });
}
