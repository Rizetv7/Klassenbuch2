import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

const COOKIE_NAME = "kb_session";
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-secret-change-me"
);

// "Unbegrenzt" in practice: the JWT itself is valid for 100 years, and the
// cookie is capped at 400 days (the hard ceiling Chrome/Safari enforce on
// Set-Cookie max-age/expires — no cookie can outlive that no matter what
// value is sent). Sliding renewal below reissues the cookie on activity, so
// as long as someone opens the app every so often the 400-day window keeps
// moving forward and the session effectively never expires.
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;
const RENEW_AFTER_SECONDS = 60 * 60 * 24; // reissue at most once a day

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("100y")
    .sign(secret);

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function destroySession(): void {
  cookies().set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

/** Returns the logged-in user id, or null. */
export async function getSessionUserId(): Promise<string | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    const userId = typeof payload.sub === "string" ? payload.sub : null;
    if (!userId) return null;

    // Sliding renewal: push the 400-day cookie ceiling forward on activity
    // so a session that's used every so often never actually expires.
    const issuedAt = typeof payload.iat === "number" ? payload.iat : 0;
    if (Date.now() / 1000 - issuedAt > RENEW_AFTER_SECONDS) {
      await createSession(userId).catch(() => {});
    }

    return userId;
  } catch {
    return null;
  }
}

/** Returns the full logged-in user (without password hash), or null. */
export async function getCurrentUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const [user, memberships] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, avatarUrl: true, accentColor: true, createdAt: true },
    }),
    prisma.membership.findMany({
      where: { userId, leftAt: null, class: { archivedAt: null } },
      select: { role: true, aminaMode: true },
    }),
  ]);
  if (!user) return null;
  const eligibleMemberships = memberships.filter((membership) => membership.role !== "OWNER");
  return {
    ...user,
    aminaMode: eligibleMemberships.some((membership) => membership.aminaMode),
    aminaAvailable: eligibleMemberships.length > 0,
    aminaUnavailableReason: memberships.length === 0 ? "no_class" : eligibleMemberships.length === 0 ? "owner" : null,
  };
}
