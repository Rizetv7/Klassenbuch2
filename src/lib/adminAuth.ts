import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const ADMIN_COOKIE_NAME = "mz_admin_session";
const ADMIN_AUDIENCE = "maturaziitig-admin";
const ADMIN_ISSUER = "maturaziitig";
// Long-lived like the regular user session (was 90 min, forcing constant
// re-logins). Sliding renewal below keeps active use logged in indefinitely;
// this is just the ceiling for a completely idle session.
const ADMIN_SESSION_SECONDS = 60 * 60 * 24 * 30;
// Only reissue the cookie when it's this old, so a busy admin panel isn't
// rewriting the session cookie on every single request.
const ADMIN_RENEW_AFTER_SECONDS = 60 * 60 * 24;

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
    const valid = payload.scope === "admin" && payload.sub === adminUsername();
    if (!valid) return false;

    // Sliding renewal: as long as the admin keeps using the panel within the
    // session window, re-issue the cookie so it never hits the idle ceiling.
    // Skipped for brand-new sessions to avoid a write on every request.
    const issuedAt = typeof payload.iat === "number" ? payload.iat : 0;
    const ageSeconds = Date.now() / 1000 - issuedAt;
    if (ageSeconds > ADMIN_RENEW_AFTER_SECONDS) {
      await createAdminSession().catch(() => {});
    }

    return true;
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
