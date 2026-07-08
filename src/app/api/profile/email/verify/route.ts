import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { consumeCode, normalizeEmail } from "@/lib/loginCode";

// Attach/change the account e-mail, step 2: confirm the code, save the address.
export async function POST(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!email || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "Bitte den 6-stelligen Code aus der Mail eingeben." }, { status: 400 });
    }

    const result = await consumeCode(email, "attach", code);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    if (result.userId !== userId) {
      return NextResponse.json({ error: "Dieser Code gehört zu einer anderen Anfrage." }, { status: 403 });
    }

    // last-second uniqueness check (someone else may have attached it meanwhile)
    const taken = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, id: { not: userId } },
    });
    if (taken) {
      return NextResponse.json({ error: "Diese E-Mail gehört schon zu einem anderen Konto." }, { status: 409 });
    }

    await prisma.user.update({ where: { id: userId }, data: { email } });
    return NextResponse.json({ ok: true, email });
  } catch (err) {
    console.error("profile email verify error", err);
    return NextResponse.json({ error: "Die E-Mail konnte nicht gespeichert werden." }, { status: 500 });
  }
}
