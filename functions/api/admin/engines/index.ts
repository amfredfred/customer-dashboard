import { verifyAdmin, gatewayHttpUrl, gatewayAdminKey } from "../../../_shared/auth";
import { getAdminSupabase } from "../../../_shared/supabase";
import type { Env } from "../../../_shared/auth";

export const onRequestGet: (ctx: { request: Request; env: Env }) => Promise<Response> = async ({ request, env }) => {
  const auth = await verifyAdmin(request, env);
  if (auth instanceof Response) return auth;

  const sb = getAdminSupabase(env);
  const { data: devices, error } = await sb
    .from("engine_devices")
    .select(`id, engine_id, device_name, engine_version, platform, status, activated_at, last_seen_at, license_id, licenses!inner(id, status, owner_user_id, expires_at)`)
    .order("activated_at", { ascending: false })
    .limit(200);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  let liveIds: string[] = [];
  try {
    const res = await fetch(`${gatewayHttpUrl(env)}/admin/connected-engines`, { headers: { "x-admin-key": gatewayAdminKey(env) } });
    if (res.ok) liveIds = ((await res.json() as { engines: string[] }).engines) ?? [];
  } catch { /* gateway unreachable */ }
  const liveSet = new Set(liveIds);

  type LicenseJoin = { id: string; status: string; owner_user_id: string; expires_at: string | null };
  const ownerIds = [...new Set((devices ?? []).map((d) => (d.licenses as unknown as LicenseJoin | null)?.owner_user_id).filter(Boolean) as string[])];
  const emailMap: Record<string, string> = {};
  await Promise.all(ownerIds.map(async (uid) => {
    const { data: u } = await sb.auth.admin.getUserById(uid);
    if (u?.user?.email) emailMap[uid] = u.user.email;
  }));

  const ONLINE_MS = 90_000, DEGRADED_MS = 300_000, now = Date.now();
  return Response.json((devices ?? []).map((d) => {
    const license = d.licenses as unknown as LicenseJoin | null;
    const elapsed = now - (d.last_seen_at ? Date.parse(d.last_seen_at) : 0);
    const connectionState = liveSet.has(d.engine_id) || elapsed < ONLINE_MS ? "online" : elapsed < DEGRADED_MS ? "degraded" : "offline";
    return {
      id: d.id, engine_id: d.engine_id, device_name: d.device_name, engine_version: d.engine_version,
      platform: d.platform, status: d.status, activated_at: d.activated_at, last_seen_at: d.last_seen_at,
      license_id: d.license_id, license_status: license?.status ?? null, license_expires_at: license?.expires_at ?? null,
      owner_user_id: license?.owner_user_id ?? null,
      owner_email: license?.owner_user_id ? (emailMap[license.owner_user_id] ?? license.owner_user_id) : null,
      connection_state: connectionState,
    };
  }));
};
