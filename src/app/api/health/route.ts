import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Public liveness probe. Never expose environment or database diagnostics.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Dienst vorübergehend nicht verfügbar." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
