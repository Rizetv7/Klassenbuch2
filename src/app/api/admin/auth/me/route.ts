import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/adminAuth";

export async function GET() {
  const authenticated = await hasAdminSession();
  return NextResponse.json(
    { authenticated },
    {
      status: authenticated ? 200 : 401,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
