import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { getAdminSupabase } from "@/lib/admin-supabase";

/** GET /api/admin/licenses - all licenses with owner email and symbol list. */
export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const sb = getAdminSupabase();

  const { data, error } = await sb
    .from("licenses")
    .select(`
      id,
      status,
      max_devices,
      expires_at,
      created_at,
      updated_at,
      owner_user_id,
      license_symbols ( symbol )
    `)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Resolve owner emails via auth admin API (service role required)
  const ownerIds = [...new Set((data ?? []).map((l) => l.owner_user_id))];
  const emailMap: Record<string, string> = {};
  await Promise.all(
    ownerIds.map(async (uid) => {
      const { data: u } = await sb.auth.admin.getUserById(uid);
      if (u?.user?.email) emailMap[uid] = u.user.email;
    }),
  );

  const rows = (data ?? []).map((l) => ({
    id: l.id,
    status: l.status,
    max_devices: l.max_devices,
    expires_at: l.expires_at,
    created_at: l.created_at,
    updated_at: l.updated_at,
    owner_user_id: l.owner_user_id,
    owner_email: emailMap[l.owner_user_id] ?? l.owner_user_id,
    symbols: (l.license_symbols as { symbol: string }[] ?? []).map((s) => s.symbol),
  }));

  return NextResponse.json(rows);
}
