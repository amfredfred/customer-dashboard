import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { getAdminSupabase } from "@/lib/admin-supabase";

/**
 * PATCH /api/admin/licenses/[id]
 * Update status ("active"|"suspended"|"expired") and/or expires_at.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await req.json() as { status?: string; expires_at?: string | null };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status !== undefined) updates.status = body.status;
  if (body.expires_at !== undefined) updates.expires_at = body.expires_at;

  const sb = getAdminSupabase();
  const { error } = await sb.from("licenses").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
