import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { getMembership } from "@/lib/classAccess";
import { ensurePollSchema } from "@/lib/pollSchema";
import { serializePolls } from "@/lib/serializePoll";

export async function POST(
  req: Request,
  { params }: { params: { pollId: string } }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  await ensurePollSchema();

  const body = await req.json().catch(() => ({}));
  const rawIds = Array.isArray(body.optionIds) ? body.optionIds : body.optionId ? [body.optionId] : [];
  const optionIds: string[] = Array.from(new Set(rawIds.map((id: unknown) => String(id)).filter(Boolean)));

  const poll = await prisma.poll.findUnique({
    where: { id: params.pollId },
    include: { options: { select: { id: true } } },
  });
  if (!poll) return NextResponse.json({ error: "Umfrage nicht gefunden." }, { status: 404 });

  const membership = await getMembership(userId, poll.classId);
  if (!membership) return NextResponse.json({ error: "Du bist kein Mitglied dieser Klasse." }, { status: 403 });
  if (optionIds.length === 0) return NextResponse.json({ error: "Bitte eine Antwort wählen." }, { status: 400 });
  if (!poll.multipleChoice && optionIds.length !== 1) {
    return NextResponse.json({ error: "Diese Umfrage erlaubt nur eine Antwort." }, { status: 400 });
  }

  const allowed = new Set(poll.options.map((option) => option.id));
  if (optionIds.some((id) => !allowed.has(id))) {
    return NextResponse.json({ error: "Ungültige Antwort." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.pollVote.deleteMany({ where: { pollId: poll.id, userId } }),
    prisma.pollVote.createMany({
      data: optionIds.map((optionId) => ({ pollId: poll.id, optionId, userId })),
      skipDuplicates: true,
    }),
  ]);

  const [serialized] = await serializePolls([poll.id], userId);
  return NextResponse.json({ poll: serialized });
}
