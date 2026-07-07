import { NextResponse } from "next/server";
import { hasAdminSession, isSameOrigin } from "@/lib/adminAuth";
import { addExistingUserToClass, MemberManagementError } from "@/lib/memberManagement";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 403 });
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
