import { NextResponse } from "next/server";
import { destroyAdminSession, isSameOrigin } from "@/lib/adminAuth";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 403 });
  }
  destroyAdminSession();
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
