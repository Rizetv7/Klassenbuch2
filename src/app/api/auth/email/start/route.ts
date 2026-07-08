import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { issueCode, normalizeEmail } from "@/lib/loginCode";

// Step 1 of the passwordless login: send a 6-digit code to the address.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    if (!email) {
      return NextResponse.json({ error: "Bitte eine gültige E-Mail-Adresse eingeben." }, { status: 400 });
    }

    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    if (!user) {
      return NextResponse.json(
        { error: "Kein Konto mit dieser E-Mail gefunden. Melde dich einmal mit Name & Passwort an und hinterlege deine E-Mail im Profil." },
        { status: 404 }
      );
    }

    const issued = await issueCode(email, "login", user.id);
    if (!issued.ok) return NextResponse.json({ error: issued.error }, { status: issued.status });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("email start error", err);
    return NextResponse.json({ error: "Der Code konnte nicht verschickt werden." }, { status: 500 });
  }
}
