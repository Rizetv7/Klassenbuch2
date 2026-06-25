import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    return await handleLogin(req);
  } catch (err) {
    console.error("login error", err);
    return NextResponse.json(
      { error: "Datenbankfehler. Sind die Tabellen angelegt und DATABASE_URL korrekt?" },
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

  const user = await prisma.user.findUnique({ where: { name: String(name).trim() } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Name oder Passwort ist falsch." }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ id: user.id, name: user.name });
}
