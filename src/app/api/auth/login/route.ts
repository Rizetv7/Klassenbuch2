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
  const { email, password } = await req.json().catch(() => ({}));

  if (!email || !password) {
    return NextResponse.json(
      { error: "E-Mail und Passwort sind erforderlich." },
      { status: 400 }
    );
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json(
      { error: "E-Mail oder Passwort ist falsch." },
      { status: 401 }
    );
  }

  await createSession(user.id);
  return NextResponse.json({ id: user.id, name: user.name, email: user.email });
}
