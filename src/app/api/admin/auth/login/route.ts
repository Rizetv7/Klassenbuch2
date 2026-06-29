import { NextResponse } from "next/server";
import {
  adminAuthConfigured,
  createAdminSession,
  isSameOrigin,
  verifyAdminCredentials,
} from "@/lib/adminAuth";

type Attempt = { count: number; resetAt: number };
const globalForAdminRateLimit = globalThis as unknown as {
  adminLoginAttempts?: Map<string, Attempt>;
};
const attempts = globalForAdminRateLimit.adminLoginAttempts ?? new Map<string, Attempt>();
if (process.env.NODE_ENV !== "production") globalForAdminRateLimit.adminLoginAttempts = attempts;

const MAX_ATTEMPTS = 6;
const WINDOW_MS = 15 * 60 * 1000;

function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return noStore({ error: "Ungültige Anfrage." }, 403);
  if (!adminAuthConfigured()) {
    return noStore({ error: "Der interne Zugang ist nicht konfiguriert." }, 503);
  }

  const key = clientKey(req);
  const now = Date.now();
  const current = attempts.get(key);
  if (current && current.resetAt > now && current.count >= MAX_ATTEMPTS) {
    return noStore({ error: "Zu viele Versuche. Bitte später erneut versuchen." }, 429);
  }
  if (current && current.resetAt <= now) attempts.delete(key);

  const { username, password } = await req.json().catch(() => ({}));
  const valid =
    typeof username === "string" &&
    typeof password === "string" &&
    password.length <= 256 &&
    (await verifyAdminCredentials(username, password));

  if (!valid) {
    const next = attempts.get(key);
    attempts.set(key, {
      count: (next?.count ?? 0) + 1,
      resetAt: next?.resetAt ?? now + WINDOW_MS,
    });
    await new Promise((resolve) => setTimeout(resolve, 650));
    return noStore({ error: "Zugangsdaten sind falsch." }, 401);
  }

  attempts.delete(key);
  await createAdminSession();
  return noStore({ ok: true });
}
