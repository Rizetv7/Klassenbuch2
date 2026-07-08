import { createHash, randomInt } from "crypto";
import { prisma } from "./db";
import { ensureLoginCodeSchema } from "./loginCodeSchema";
import { sendCodeMail } from "./mailer";

const CODE_TTL_MS = 10 * 60 * 1000; // codes live 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // at most one mail per minute per address
const MAX_ATTEMPTS = 5;

export type CodePurpose = "login" | "attach";

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function hashCode(code: string): string {
  // keyed hash: enough for 6-digit codes that expire after 10 minutes
  return createHash("sha256").update(`${process.env.AUTH_SECRET || "dev-secret-change-me"}:${code}`).digest("hex");
}

/** Create a fresh code for the address and e-mail it. */
export async function issueCode(
  email: string,
  purpose: CodePurpose,
  userId: string | null
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  await ensureLoginCodeSchema();

  const latest = await prisma.loginCode.findFirst({
    where: { email, purpose },
    orderBy: { createdAt: "desc" },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, error: "Code wurde gerade verschickt — schau in dein Postfach (auch Spam).", status: 429 };
  }

  const code = String(randomInt(0, 1000000)).padStart(6, "0");

  const sent = await sendCodeMail(email, code);
  if (!sent.ok) return { ok: false, error: sent.error, status: 502 };

  // one active code per address+purpose keeps the table tiny
  await prisma.loginCode.deleteMany({ where: { email, purpose } });
  await prisma.loginCode.create({
    data: { email, purpose, codeHash: hashCode(code), userId, expiresAt: new Date(Date.now() + CODE_TTL_MS) },
  });

  return { ok: true };
}

/** Check a submitted code; on success the code is burned. */
export async function consumeCode(
  email: string,
  purpose: CodePurpose,
  code: string
): Promise<{ ok: true; userId: string | null } | { ok: false; error: string; status: number }> {
  await ensureLoginCodeSchema();

  const entry = await prisma.loginCode.findFirst({
    where: { email, purpose },
    orderBy: { createdAt: "desc" },
  });
  if (!entry || entry.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "Der Code ist abgelaufen. Lass dir einen neuen schicken.", status: 400 };
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "Zu viele Versuche. Lass dir einen neuen Code schicken.", status: 429 };
  }

  await prisma.loginCode.update({ where: { id: entry.id }, data: { attempts: { increment: 1 } } });

  if (hashCode(String(code).trim()) !== entry.codeHash) {
    return { ok: false, error: "Der Code stimmt nicht. Schau nochmal in die Mail.", status: 401 };
  }

  await prisma.loginCode.deleteMany({ where: { email, purpose } });
  return { ok: true, userId: entry.userId };
}
