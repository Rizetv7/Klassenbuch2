import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Diagnostic endpoint: open /api/health in the browser to see whether the
// server can reach the database and which env vars are present. The password
// in the DB host is masked; no secrets are returned.
export const dynamic = "force-dynamic";

export async function GET() {
  const raw = process.env.DATABASE_URL || "";
  // show only host:port/db (mask everything before @)
  const hostPart = raw.includes("@") ? raw.split("@")[1] : null;

  const env = {
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    dbHost: hostPart ? hostPart.split("?")[0] : null,
    pgbouncer: raw.includes("pgbouncer=true"),
    hasAuthSecret: !!process.env.AUTH_SECRET,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  try {
    const users = await prisma.user.count();
    return NextResponse.json({ ok: true, users, env });
  } catch (err: unknown) {
    const e = err as { name?: string; code?: string; message?: string };
    return NextResponse.json(
      {
        ok: false,
        env,
        error: {
          name: e?.name ?? null,
          code: e?.code ?? null,
          message: (e?.message ?? String(err)).slice(0, 500),
        },
      },
      { status: 500 }
    );
  }
}
