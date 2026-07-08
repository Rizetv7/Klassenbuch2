import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { issueCode, normalizeEmail } from "@/lib/loginCode";

// Attach/change the account e-mail, step 1: send a code to the NEW address
// so nobody can claim a mailbox that isn't theirs.
export async function POST(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    if (!email) {
      return NextResponse.json({ error: "Bitte eine gültige E-Mail-Adresse eingeben." }, { status: 400 });
    }

    const taken = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, id: { not: userId } },
    });
    if (taken) {
      return NextResponse.json({ error: "Diese E-Mail gehört schon zu einem anderen Konto." }, { status: 409 });
    }

    const issued = await issueCode(email, "attach", userId);
    if (!issued.ok) return NextResponse.json({ error: issued.error }, { status: issued.status });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("profile email start error", err);
    return NextResponse.json({ error: "Der Code konnte nicht verschickt werden." }, { status: 500 });
  }
}
