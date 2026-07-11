import { NextResponse } from "next/server";
import { hasAdminSession, isSameOrigin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { ensureImportSchema } from "@/lib/importSchema";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; batchId: string } },
) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 403 });
  }

  await ensureImportSchema();
  const body = await req.json().catch(() => ({}));
  if (body.action !== "anonymize" || body.confirmation !== "ANONYM") {
    return NextResponse.json(
      { error: "Zur Bestätigung muss ANONYM eingegeben werden." },
      { status: 400 },
    );
  }

  const batch = await prisma.importBatch.findFirst({
    where: { id: params.batchId, classId: params.id },
    select: {
      id: true,
      itemCount: true,
      anonymizedAt: true,
      _count: { select: { posts: true, pendingItems: true } },
    },
  });
  if (!batch) {
    return NextResponse.json({ error: "Import nicht gefunden." }, { status: 404 });
  }

  const anonymizedAt = batch.anonymizedAt ?? new Date();
  const [updated] = await prisma.$transaction([
    prisma.post.updateMany({
      where: {
        classId: params.id,
        importBatchId: batch.id,
        anonymous: false,
      },
      data: { anonymous: true },
    }),
    prisma.importBatch.update({
      where: { id: batch.id },
      data: { anonymizedAt },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    changedPosts: updated.count,
    totalPosts: batch._count.posts,
    pendingItems: batch._count.pendingItems,
    anonymizedAt,
  });
}
