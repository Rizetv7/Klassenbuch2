import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { hasAminaMode } from "@/lib/aminaMode";

export async function POST(req: Request) {
  try {
    return await handleLogin(req);
  } catch (err) {
    console.error("login error", err);
    const e = err as { code?: string; message?: string };
    return NextResponse.json(
      { error: `DB-Fehler [${e?.code ?? "?"}]: ${(e?.message ?? String(err)).slice(0, 300)}` },
      { status: 500 }
    );
  }
}

async function handleLogin(req: Request) {
  const { name, password } = await req.json().catch(() => ({}));

  if (!name || !password) {
    return NextResponse.json(
      { error: "Name und Passwort sind erforderlich." },
      { status: 400 }
    );
  }

  // Forgiving lookup: upper/lower case doesn't matter — people rarely
  // remember the exact spelling they registered with.
  const user = await prisma.user.findFirst({
    where: { name: { equals: String(name).trim(), mode: "insensitive" } },
  });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Name oder Passwort ist falsch." }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ id: user.id, name: user.name, aminaMode: await hasAminaMode(user.id) });
}
