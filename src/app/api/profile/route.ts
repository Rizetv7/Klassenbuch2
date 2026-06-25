import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";

// Update the current user's profile.
export async function PATCH(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const { name, avatarUrl } = await req.json().catch(() => ({}));
  const data: { name?: string; avatarUrl?: string } = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (typeof avatarUrl === "string") data.avatarUrl = avatarUrl;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nichts zu aktualisieren." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, email: true, avatarUrl: true, accentColor: true },
  });
  return NextResponse.json({ user });
}
