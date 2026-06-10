import { verifyAdmin } from "../../../_shared/auth";
import { getAdminSupabase } from "../../../_shared/supabase";
import type { Env } from "../../../_shared/auth";

export const onRequestGet: (ctx: { request: Request; env: Env }) => Promise<Response> = async ({ request, env }) => {
  const auth = await verifyAdmin(request, env);
  if (auth instanceof Response) return auth;

  const sb = getAdminSupabase(env);

  const { data, error } = await sb
    .from("licenses")
    .select("id, status, max_devices, expires_at, created_at, updated_at, owner_user_id")
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const licenseIds = (data ?? []).map((l) => l.id);
  const symbolMap: Record<string, string[]> = {};
  if (licenseIds.length > 0) {
    const { data: symRows } = await sb.from("license_symbols").select("license_id, symbol").in("license_id", licenseIds);
    for (const row of symRows ?? []) {
      const r = row as { license_id: string; symbol: string };
      (symbolMap[r.license_id] ??= []).push(r.symbol);
    }
  }

  const ownerIds = [...new Set((data ?? []).map((l) => l.owner_user_id))];
  const emailMap: Record<string, string> = {};
  await Promise.all(ownerIds.map(async (uid) => {
    const { data: u } = await sb.auth.admin.getUserById(uid);
    if (u?.user?.email) emailMap[uid] = u.user.email;
  }));

  return Response.json((data ?? []).map((l) => ({
    id: l.id, status: l.status, max_devices: l.max_devices,
    expires_at: l.expires_at, created_at: l.created_at, updated_at: l.updated_at,
    owner_user_id: l.owner_user_id, owner_email: emailMap[l.owner_user_id] ?? l.owner_user_id,
    symbols: symbolMap[l.id] ?? [],
  })));
};
