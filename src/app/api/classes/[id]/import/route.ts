import { NextResponse } from "next/server";
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

function clean(value: unknown, max = 1000) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function normalizeEntry(entry: ImportEntry) {
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

async function assertTarget(classId: string, subjectMembershipId: string | null, teacherId: string | null) {
  if (subjectMembershipId) {
    const subject = await prisma.membership.findUnique({ where: { id: subjectMembershipId } });
    if (!subject || subject.classId !== classId) return null;
    return { subjectMembershipId: subject.id, teacherId: null };
  }
  if (teacherId) {
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!teacher || teacher.classId !== classId) return null;
    return { subjectMembershipId: null, teacherId: teacher.id };
  }
  return { subjectMembershipId: null, teacherId: null };
}

async function createPostFromEntry(classId: string, userId: string, entry: {
  kind: string;
  text: string | null;
  context: string | null;
  imageUrl: string | null;
  subjectMembershipId: string | null;
  teacherId: string | null;
}) {
  return prisma.post.create({
    data: {
      classId,
      authorId: userId,
      board: "YEARBOOK",
      kind: entry.kind,
      text: entry.text,
      context: entry.kind === "QUOTE" ? entry.context : null,
      imageUrl: entry.imageUrl,
      anonymous: false,
      subjectMembershipId: entry.subjectMembershipId,
      teacherId: entry.teacherId,
    },
  });
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

  const entries = [];
  for (const raw of rawEntries) {
    const normalized = normalizeEntry(raw);
    if ("error" in normalized) return NextResponse.json({ error: normalized.error }, { status: 400 });
    entries.push(normalized);
  }

  let imported = 0;
  let pending = 0;

  for (const entry of entries) {
    const target = await assertTarget(params.id, entry.subjectMembershipId, entry.teacherId);
    if (!target) return NextResponse.json({ error: `Ungültige Zuordnung für ${entry.rawName}.` }, { status: 400 });

    if (target.subjectMembershipId || target.teacherId) {
      await createPostFromEntry(params.id, userId, {
        kind: entry.kind,
        text: entry.text,
        context: entry.context,
        imageUrl: entry.imageUrl,
        subjectMembershipId: target.subjectMembershipId,
        teacherId: target.teacherId,
      });
      imported++;
    } else {
      await prisma.importItem.create({
        data: {
          classId: params.id,
          createdById: userId,
          rawName: entry.rawName,
          targetType: entry.targetType,
          kind: entry.kind,
          text: entry.text,
          context: entry.context,
          imageUrl: entry.imageUrl,
        },
      });
      pending++;
    }
  }

  return NextResponse.json({ imported, pending });
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

  const item = await prisma.importItem.findUnique({ where: { id: itemId } });
  if (!item || item.classId !== params.id) return NextResponse.json({ error: "Import-Eintrag nicht gefunden." }, { status: 404 });

  const target = await assertTarget(params.id, subjectMembershipId, teacherId);
  if (!target || (!target.subjectMembershipId && !target.teacherId)) {
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
        anonymous: false,
        subjectMembershipId: target.subjectMembershipId,
        teacherId: target.teacherId,
      },
    }),
    prisma.importItem.delete({ where: { id: item.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
