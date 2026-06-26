import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId, hashPassword, verifyPassword } from "@/lib/auth";

// Update the current user's profile.
export async function PATCH(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const { name, avatarUrl, currentPassword, newPassword } = await req.json().catch(() => ({}));
  const data: { name?: string; avatarUrl?: string; passwordHash?: string } = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (typeof avatarUrl === "string") data.avatarUrl = avatarUrl;
  if (typeof newPassword === "string" && newPassword.length > 0) {
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Das neue Passwort muss mindestens 6 Zeichen lang sein." }, { status: 400 });
    }
    if (typeof currentPassword !== "string" || !currentPassword) {
      return NextResponse.json({ error: "Aktuelles Passwort ist erforderlich." }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!existing || !(await verifyPassword(currentPassword, existing.passwordHash))) {
      return NextResponse.json({ error: "Aktuelles Passwort ist falsch." }, { status: 403 });
    }
    data.passwordHash = await hashPassword(newPassword);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nichts zu aktualisieren." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, email: true, avatarUrl: true, accentColor: true },
  });

  // Keep the per-class display snapshots in sync with the account name so
  // sorting and newly created poll options use the current name too.
  if (data.name) {
    await prisma.membership.updateMany({ where: { userId }, data: { displayName: data.name } });
  }

  return NextResponse.json({ user });
}
