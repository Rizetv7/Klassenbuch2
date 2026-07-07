import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getMembership } from "@/lib/classAccess";
import { isSameOrigin } from "@/lib/adminAuth";
import { addExistingUserToClass, MemberManagementError } from "@/lib/memberManagement";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 403 });
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const me = await getMembership(userId, params.id);
  if (!me || me.role !== "OWNER") {
    return NextResponse.json({ error: "Nur die Ersteller:in kann Personen direkt hinzufügen." }, { status: 403 });
  }

  const { name } = await req.json().catch(() => ({}));
  try {
    const result = await addExistingUserToClass(params.id, name);
    return NextResponse.json({ ok: true, restored: result.restored, membershipId: result.membership.id });
  } catch (error) {
    if (error instanceof MemberManagementError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
