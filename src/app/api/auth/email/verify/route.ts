import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { hasAminaMode } from "@/lib/aminaMode";
import { prisma } from "@/lib/db";
import { consumeCode, normalizeEmail } from "@/lib/loginCode";

// Step 2 of the passwordless login: check the code, then sign in.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!email || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "Bitte den 6-stelligen Code aus der Mail eingeben." }, { status: 400 });
    }

    const result = await consumeCode(email, "login", code);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    const user = result.userId
      ? await prisma.user.findUnique({ where: { id: result.userId } })
      : null;
    if (!user) {
      return NextResponse.json({ error: "Konto nicht gefunden." }, { status: 404 });
    }

    await createSession(user.id);
    return NextResponse.json({ id: user.id, name: user.name, aminaMode: await hasAminaMode(user.id) });
  } catch (err) {
    console.error("email verify error", err);
    return NextResponse.json({ error: "Anmeldung fehlgeschlagen." }, { status: 500 });
  }
}
