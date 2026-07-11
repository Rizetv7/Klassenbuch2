import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { getMembership } from "@/lib/classAccess";
import { ensureImportSchema } from "@/lib/importSchema";

type ImportEntry = {
  rawName?: unknown;
  targetType?: unknown;
  kind?: unknown;
  text?: unknown;
  context?: unknown;
  imageUrl?: unknown;
  subjectMembershipId?: unknown;
  teacherId?: unknown;
};

type NormalizedEntry = {
  rawName: string;
  targetType: "STUDENT" | "TEACHER";
  kind: "QUOTE" | "TEXT" | "IMAGE";
  text: string | null;
  context: string | null;
  imageUrl: string | null;
  subjectMembershipId: string | null;
  teacherId: string | null;
};

function clean(value: unknown, max = 1000) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function normalizeEntry(entry: ImportEntry): NormalizedEntry | { error: string } {
  const rawName = clean(entry.rawName, 120);
  const targetType = entry.targetType === "TEACHER" ? "TEACHER" : "STUDENT";
  const kind = entry.kind === "IMAGE" || entry.kind === "TEXT" ? entry.kind : "QUOTE";
  const text = clean(entry.text, 1400);
  const context = clean(entry.context, 320);
  const imageUrl = clean(entry.imageUrl, 1200);
  const subjectMembershipId = clean(entry.subjectMembershipId, 120);
  const teacherId = clean(entry.teacherId, 120);

  if (!rawName) return { error: "Ein Eintrag hat keinen Namen." };
  if (kind === "IMAGE" && !imageUrl) return { error: `Bild-Eintrag für ${rawName} braucht eine Bild-URL.` };
  if (kind !== "IMAGE" && !text) return { error: `Text fehlt bei ${rawName}.` };
  if (subjectMembershipId && teacherId) return { error: `Bitte ${rawName} nur einer Person zuordnen.` };

  return { rawName, targetType, kind, text, context, imageUrl, subjectMembershipId, teacherId };
}

async function invalidTargetName(classId: string, entries: NormalizedEntry[]) {
  const subjectIds = Array.from(new Set(entries.map((entry) => entry.subjectMembershipId).filter(Boolean))) as string[];
  const teacherIds = Array.from(new Set(entries.map((entry) => entry.teacherId).filter(Boolean))) as string[];
  const [subjects, teachers] = await Promise.all([
    subjectIds.length
      ? prisma.membership.findMany({
          where: { id: { in: subjectIds }, classId, leftAt: null },
          select: { id: true },
        })
      : Promise.resolve([]),
    teacherIds.length
      ? prisma.teacher.findMany({
          where: { id: { in: teacherIds }, classId },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);
  const validSubjects = new Set(subjects.map((subject) => subject.id));
  const validTeachers = new Set(teachers.map((teacher) => teacher.id));
  return entries.find((entry) =>
    (entry.subjectMembershipId && !validSubjects.has(entry.subjectMembershipId))
    || (entry.teacherId && !validTeachers.has(entry.teacherId))
  )?.rawName ?? null;
}

function importSource(value: unknown, entries: NormalizedEntry[]) {
  if (typeof value === "string" && value.trim()) return value.trim().slice(0, 120_000);
  return entries.map((entry) => {
    const content = entry.imageUrl || entry.text || "";
    return `${entry.rawName} | ${entry.kind} | ${content}${entry.context ? ` | ${entry.context}` : ""}`;
  }).join("\n").slice(0, 120_000);
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const membership = await getMembership(userId, params.id);
  if (!membership) return NextResponse.json({ error: "Du bist kein Mitglied dieser Klasse." }, { status: 403 });

  await ensureImportSchema();

  const pending = await prisma.importItem.findMany({
    where: { classId: params.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      importBatch: {
        select: { id: true, createdAt: true, anonymizedAt: true },
      },
    },
  });

  return NextResponse.json({ pending });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const membership = await getMembership(userId, params.id);
  if (!membership) return NextResponse.json({ error: "Du bist kein Mitglied dieser Klasse." }, { status: 403 });

  await ensureImportSchema();

  const body = await req.json().catch(() => ({}));
  const rawEntries = Array.isArray(body.entries) ? body.entries.slice(0, 200) : [];
  if (rawEntries.length === 0) return NextResponse.json({ error: "Keine Import-Einträge gefunden." }, { status: 400 });

  const entries: NormalizedEntry[] = [];
  for (const raw of rawEntries) {
    const normalized = normalizeEntry(raw);
    if ("error" in normalized) return NextResponse.json({ error: normalized.error }, { status: 400 });
    entries.push(normalized);
  }

  const invalidTarget = await invalidTargetName(params.id, entries);
  if (invalidTarget) {
    return NextResponse.json({ error: `Ungültige Zuordnung für ${invalidTarget}.` }, { status: 400 });
  }

  const batchId = randomUUID();
  const assigned = entries.filter((entry) => entry.subjectMembershipId || entry.teacherId);
  const unassigned = entries.filter((entry) => !entry.subjectMembershipId && !entry.teacherId);
  const writes: Prisma.PrismaPromise<unknown>[] = [
    prisma.importBatch.create({
      data: {
        id: batchId,
        classId: params.id,
        createdById: userId,
        sourceText: importSource(body.sourceText, entries),
        itemCount: entries.length,
      },
    }),
  ];
  if (assigned.length) {
    writes.push(prisma.post.createMany({
      data: assigned.map((entry) => ({
        classId: params.id,
        authorId: userId,
        board: "YEARBOOK",
        kind: entry.kind,
        text: entry.text,
        context: entry.kind === "QUOTE" ? entry.context : null,
        imageUrl: entry.imageUrl,
        anonymous: false,
        subjectMembershipId: entry.subjectMembershipId,
        teacherId: entry.teacherId,
        importBatchId: batchId,
      })),
    }));
  }
  if (unassigned.length) {
    writes.push(prisma.importItem.createMany({
      data: unassigned.map((entry) => ({
        classId: params.id,
        createdById: userId,
        importBatchId: batchId,
        rawName: entry.rawName,
        targetType: entry.targetType,
        kind: entry.kind,
        text: entry.text,
        context: entry.context,
        imageUrl: entry.imageUrl,
      })),
    }));
  }
  await prisma.$transaction(writes);

  return NextResponse.json({ batchId, imported: assigned.length, pending: unassigned.length });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const membership = await getMembership(userId, params.id);
  if (!membership) return NextResponse.json({ error: "Du bist kein Mitglied dieser Klasse." }, { status: 403 });

  await ensureImportSchema();

  const body = await req.json().catch(() => ({}));
  const itemId = clean(body.itemId, 120);
  const subjectMembershipId = clean(body.subjectMembershipId, 120);
  const teacherId = clean(body.teacherId, 120);
  if (!itemId) return NextResponse.json({ error: "Import-Eintrag fehlt." }, { status: 400 });
  if (subjectMembershipId && teacherId) {
    return NextResponse.json({ error: "Bitte nur eine Person auswählen." }, { status: 400 });
  }

  const item = await prisma.importItem.findUnique({
    where: { id: itemId },
    include: { importBatch: { select: { id: true, anonymizedAt: true } } },
  });
  if (!item || item.classId !== params.id) return NextResponse.json({ error: "Import-Eintrag nicht gefunden." }, { status: 404 });

  const targetEntry: NormalizedEntry = {
    rawName: item.rawName,
    targetType: item.targetType === "TEACHER" ? "TEACHER" : "STUDENT",
    kind: item.kind === "IMAGE" || item.kind === "TEXT" ? item.kind : "QUOTE",
    text: item.text,
    context: item.context,
    imageUrl: item.imageUrl,
    subjectMembershipId,
    teacherId,
  };
  const invalidTarget = await invalidTargetName(params.id, [targetEntry]);
  if (invalidTarget || (!subjectMembershipId && !teacherId)) {
    return NextResponse.json({ error: "Bitte eine gültige Person auswählen." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.post.create({
      data: {
        classId: params.id,
        authorId: userId,
        board: "YEARBOOK",
        kind: item.kind,
        text: item.text,
        context: item.kind === "QUOTE" ? item.context : null,
        imageUrl: item.imageUrl,
        anonymous: Boolean(item.importBatch?.anonymizedAt),
        subjectMembershipId,
        teacherId,
        importBatchId: item.importBatchId,
      },
    }),
    prisma.importItem.delete({ where: { id: item.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
