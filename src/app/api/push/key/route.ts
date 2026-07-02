import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getVapidKeys } from "@/lib/push";

export const runtime = "nodejs";

// Public VAPID key for the client's pushManager.subscribe().
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const keys = await getVapidKeys();
  return NextResponse.json({ publicKey: keys.publicKey });
}
