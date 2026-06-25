import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";

const ACCENTS = ["#7E5BD9", "#8FB6EF", "#C77ACF", "#B68CF0", "#6FA8E8", "#E49ED0"];

export async function POST(req: Request) {
  try {
    return await handleRegister(req);
  } catch (err) {
    console.error("register error", err);
    return NextResponse.json(
      { error: "Datenbankfehler. Sind die Tabellen angelegt und DATABASE_URL korrekt?" },
      { status: 500 }
    );
  }
}

async function handleRegister(req: Request) {
  const { name, password, email } = await req.json().catch(() => ({}));

  if (!name || !password) {
    return NextResponse.json(
      { error: "Name und Passwort sind erforderlich." },
      { status: 400 }
    );
  }
  if (String(name).trim().length < 2) {
    return NextResponse.json({ error: "Bitte einen längeren Namen wählen." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Das Passwort muss mindestens 6 Zeichen lang sein." },
      { status: 400 }
    );
  }

  const cleanName = String(name).trim();
  const existing = await prisma.user.findUnique({ where: { name: cleanName } });
  if (existing) {
    return NextResponse.json(
      { error: "Dieser Name ist schon vergeben. Füge z. B. deinen Nachnamen hinzu." },
      { status: 409 }
    );
  }

  const user = await prisma.user.create({
    data: {
      name: cleanName,
      email: email ? String(email).toLowerCase().trim() : null,
      passwordHash: await hashPassword(password),
      accentColor: ACCENTS[Math.floor(Math.random() * ACCENTS.length)],
    },
  });

  await createSession(user.id);
  return NextResponse.json({ id: user.id, name: user.name });
}
