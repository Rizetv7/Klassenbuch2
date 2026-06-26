import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { getMembership } from "@/lib/classAccess";
import { ensurePollSchema } from "@/lib/pollSchema";
import { serializePolls } from "@/lib/serializePoll";

type CandidateTarget = {
  subjectMembershipId?: string;
  teacherId?: string;
};

function cleanId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : undefined;
}

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
  const candidateTargets: CandidateTarget[] = Array.isArray(body.candidateTargets)
    ? body.candidateTargets
        .map((target: unknown) => {
          const record = target && typeof target === "object" ? target as Record<string, unknown> : {};
          return {
            subjectMembershipId: cleanId(record.subjectMembershipId),
            teacherId: cleanId(record.teacherId),
          };
        })
        .filter((target: CandidateTarget) => target.subjectMembershipId || target.teacherId)
    : [];
  const seenTargets = new Set<string>();
  const uniqueCandidateTargets = candidateTargets.filter((target) => {
    const key = target.subjectMembershipId ? `student:${target.subjectMembershipId}` : `teacher:${target.teacherId}`;
    if (seenTargets.has(key)) return false;
    seenTargets.add(key);
    return true;
  });

  const poll = await prisma.poll.findUnique({
    where: { id: params.pollId },
    include: { options: { select: { id: true } } },
  });
  if (!poll) return NextResponse.json({ error: "Umfrage nicht gefunden." }, { status: 404 });

  const membership = await getMembership(userId, poll.classId);
  if (!membership) return NextResponse.json({ error: "Du bist kein Mitglied dieser Klasse." }, { status: 403 });
  if (!poll.candidateType && uniqueCandidateTargets.length > 0) {
    return NextResponse.json({ error: "Diese Umfrage erlaubt keine Personen-Kandidaten." }, { status: 400 });
  }
  const selectionCount = optionIds.length + uniqueCandidateTargets.length;
  if (!poll.multipleChoice && selectionCount > 1) {
    return NextResponse.json({ error: "Diese Umfrage erlaubt nur eine Antwort." }, { status: 400 });
  }

  const allowed = new Set(poll.options.map((option) => option.id));
  if (optionIds.some((id) => !allowed.has(id))) {
    return NextResponse.json({ error: "Ungültige Antwort." }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const finalOptionIds = [...optionIds];

      for (const target of uniqueCandidateTargets) {
        if (poll.candidateType === "STUDENTS") {
          const subject = target.subjectMembershipId
            ? await tx.membership.findUnique({
                where: { id: target.subjectMembershipId },
                select: { id: true, classId: true, memberType: true, displayName: true },
              })
            : null;
          if (!subject || subject.classId !== poll.classId || subject.memberType !== "STUDENT") {
            throw new Error("Ungültige Schüler:in.");
          }

          let option = await tx.pollOption.findFirst({
            where: { pollId: poll.id, subjectMembershipId: subject.id },
            select: { id: true },
          });
          if (!option) {
            const max = await tx.pollOption.aggregate({ where: { pollId: poll.id }, _max: { position: true } });
            option = await tx.pollOption.create({
              data: {
                pollId: poll.id,
                text: subject.displayName,
                position: (max._max.position ?? -1) + 1,
                subjectMembershipId: subject.id,
              },
              select: { id: true },
            });
          }
          finalOptionIds.push(option.id);
        } else if (poll.candidateType === "TEACHERS") {
          const teacher = target.teacherId
            ? await tx.teacher.findUnique({
                where: { id: target.teacherId },
                select: { id: true, classId: true, name: true, subject: true },
              })
            : null;
          if (!teacher || teacher.classId !== poll.classId) {
            throw new Error("Ungültige Lehrperson.");
          }

          let option = await tx.pollOption.findFirst({
            where: { pollId: poll.id, teacherId: teacher.id },
            select: { id: true },
          });
          if (!option) {
            const max = await tx.pollOption.aggregate({ where: { pollId: poll.id }, _max: { position: true } });
            option = await tx.pollOption.create({
              data: {
                pollId: poll.id,
                text: teacher.subject ? `${teacher.name} (${teacher.subject})` : teacher.name,
                position: (max._max.position ?? -1) + 1,
                teacherId: teacher.id,
              },
              select: { id: true },
            });
          }
          finalOptionIds.push(option.id);
        }
      }

      const uniqueFinalOptionIds = Array.from(new Set(finalOptionIds));
      await tx.pollVote.deleteMany({ where: { pollId: poll.id, userId } });
      if (uniqueFinalOptionIds.length > 0) {
        await tx.pollVote.createMany({
          data: uniqueFinalOptionIds.map((optionId) => ({ pollId: poll.id, optionId, userId })),
          skipDuplicates: true,
        });
      }
      await tx.$executeRawUnsafe(
        `DELETE FROM "PollOption" option
         WHERE option."pollId" = $1
         AND (option."subjectMembershipId" IS NOT NULL OR option."teacherId" IS NOT NULL)
         AND NOT EXISTS (SELECT 1 FROM "PollVote" vote WHERE vote."optionId" = option."id")`,
        poll.id
      );
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Abstimmen fehlgeschlagen." },
      { status: 400 }
    );
  }

  const [serialized] = await serializePolls([poll.id], userId);
  return NextResponse.json({ poll: serialized });
}
