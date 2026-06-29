import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { hasAdminSession, isSameOrigin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 403 });
  }

  const { name } = await req.json().catch(() => ({}));
  const cleanName = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  if (cleanName.length < 2 || cleanName.length > 60) {
    return NextResponse.json(
      { error: "Der Name muss zwischen 2 und 60 Zeichen lang sein." },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findFirst({
    where: { name: cleanName, id: { not: params.id } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "Dieser Name ist bereits vergeben." }, { status: 409 });
  }

  try {
    const [user] = await prisma.$transaction([
      prisma.user.update({
        where: { id: params.id },
        data: { name: cleanName },
        select: { id: true, name: true, email: true, avatarUrl: true, accentColor: true },
      }),
      prisma.membership.updateMany({
        where: { userId: params.id },
        data: { displayName: cleanName },
      }),
    ]);

    return NextResponse.json(
      { user },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json({ error: "Dieser Name ist bereits vergeben." }, { status: 409 });
      }
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });
      }
    }
    throw error;
  }
}
