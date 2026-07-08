import { NextResponse } from "next/server";
import { hasAdminSession, isSameOrigin } from "@/lib/adminAuth";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Readable word-number passwords ("SonneTiger27"): easy to pass on verbally,
// easy to type on a phone, still ~1M+ combinations.
const WORDS_A = ["Sonne", "Mond", "Stern", "Blitz", "Wolke", "Regen", "Feuer", "Wald", "Berg", "Fluss", "Pizza", "Salto", "Turbo", "Disco", "Panda", "Zebra"];
const WORDS_B = ["Tiger", "Falke", "Otter", "Fuchs", "Luchs", "Delfin", "Koala", "Igel", "Biber", "Wal", "Drache", "Komet", "Rakete", "Anker", "Magnet", "Kaktus"];

function generatePassword(): string {
  const a = WORDS_A[Math.floor(Math.random() * WORDS_A.length)];
  const b = WORDS_B[Math.floor(Math.random() * WORDS_B.length)];
  const n = 10 + Math.floor(Math.random() * 90);
  return `${a}${b}${n}`;
}

// Admin resets a person's password. Existing passwords are stored as one-way
// hashes and can never be read back — instead the admin gets the NEW password
// shown exactly once and passes it on; the person can change it afterwards.
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  let password = typeof body.password === "string" ? body.password.trim() : "";
  if (password && password.length < 6) {
    return NextResponse.json({ error: "Das Passwort muss mindestens 6 Zeichen lang sein." }, { status: 400 });
  }
  if (!password) password = generatePassword();

  const user = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true, name: true } });
  if (!user) return NextResponse.json({ error: "Person nicht gefunden." }, { status: 404 });

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password) },
  });

  return NextResponse.json(
    { ok: true, name: user.name, password },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
