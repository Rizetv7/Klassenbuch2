import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, name, password } = await req.json().catch(() => ({}));

  if (!email || !name || !password) {
    return NextResponse.json(
      { error: "E-Mail, Name und Passwort sind erforderlich." },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Das Passwort muss mindestens 6 Zeichen lang sein." },
      { status: 400 }
    );
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json(
      { error: "Diese E-Mail ist bereits registriert." },
      { status: 409 }
    );
  }

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: String(name).trim(),
      passwordHash: await hashPassword(password),
    },
  });

  await createSession(user.id);
  return NextResponse.json({ id: user.id, name: user.name, email: user.email });
}
