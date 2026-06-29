import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const ADMIN_COOKIE_NAME = "mz_admin_session";
const ADMIN_AUDIENCE = "maturaziitig-admin";
const ADMIN_ISSUER = "maturaziitig";
const ADMIN_SESSION_SECONDS = 60 * 90;

// This fallback is a bcrypt hash of a generated high-entropy password. The
// plaintext credential is never stored in the repository or the database.
const FALLBACK_ADMIN_USERNAME = "archiv-admin";
const FALLBACK_ADMIN_PASSWORD_HASH =
  "$2a$12$jI5QZUQ8CkfU0Jvu/dVxu.2lieq3mIT8IzVhExLQ5M8tr8i9zWiUS";

function adminSecret(): Uint8Array | null {
  const secret = process.env.ADMIN_AUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

export function adminUsername(): string {
  return process.env.ADMIN_USERNAME || FALLBACK_ADMIN_USERNAME;
}

function adminPasswordHash(): string {
  return process.env.ADMIN_PASSWORD_HASH || FALLBACK_ADMIN_PASSWORD_HASH;
}

export function adminAuthConfigured(): boolean {
  return adminSecret() !== null;
}

export async function verifyAdminCredentials(username: string, password: string): Promise<boolean> {
  const expectedUsername = adminUsername();
  const usernameMatches = username.trim() === expectedUsername;

  // Always run bcrypt so a wrong username does not provide a useful timing
  // difference for credential discovery.
  const passwordMatches = await bcrypt.compare(password, adminPasswordHash()).catch(() => false);
  return usernameMatches && passwordMatches;
}

export async function createAdminSession(): Promise<void> {
  const secret = adminSecret();
  if (!secret) throw new Error("Admin authentication is not configured");

  const token = await new SignJWT({ scope: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(adminUsername())
    .setIssuer(ADMIN_ISSUER)
    .setAudience(ADMIN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_SECONDS}s`)
    .sign(secret);

  cookies().set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_SECONDS,
  });
}

export function destroyAdminSession(): void {
  cookies().set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export async function hasAdminSession(): Promise<boolean> {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const secret = adminSecret();
  if (!token || !secret) return false;

  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ADMIN_ISSUER,
      audience: ADMIN_AUDIENCE,
    });
    return payload.scope === "admin" && payload.sub === adminUsername();
  } catch {
    return false;
  }
}

export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}
