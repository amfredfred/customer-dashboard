import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, gatewayHttpUrl, gatewayAdminKey } from "@/lib/admin-auth";
import { getAdminSupabase } from "@/lib/admin-supabase";

/** GET /api/admin/engines - all engine devices with latest session + live status. */
export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const sb = getAdminSupabase();

  // Fetch devices with their latest session and owning license
  const { data: devices, error } = await sb
    .from("engine_devices")
    .select(`
      id,
      engine_id,
      device_name,
      engine_version,
      platform,
      status,
      activated_at,
      last_seen_at,
      license_id,
      licenses!inner (
        id,
        status,
        owner_user_id,
        expires_at
      )
    `)
    .order("activated_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get live connected engine IDs from gateway
  let liveIds: string[] = [];
  try {
    const res = await fetch(`${gatewayHttpUrl()}/admin/connected-engines`, {
      headers: { "x-admin-key": gatewayAdminKey() },
    });
    if (res.ok) {
      const body = await res.json() as { engines: string[] };
      liveIds = body.engines ?? [];
    }
  } catch {
    // gateway unreachable - fall back to heartbeat-based status
  }
  const liveSet = new Set(liveIds);

  type LicenseJoin = { id: string; status: string; owner_user_id: string; expires_at: string | null };

  // Resolve owner emails via auth admin API (service role required)
  const ownerIds = [
    ...new Set(
      (devices ?? []).map(
        (d) => (d.licenses as unknown as LicenseJoin | null)?.owner_user_id,
      ).filter(Boolean) as string[],
    ),
  ];
  const emailMap: Record<string, string> = {};
  await Promise.all(
    ownerIds.map(async (uid) => {
      const { data: u } = await sb.auth.admin.getUserById(uid);
      if (u?.user?.email) emailMap[uid] = u.user.email;
    }),
  );

  const ONLINE_MS   = 90_000;
  const DEGRADED_MS = 300_000;
  const now = Date.now();

  const rows = (devices ?? []).map((d) => {
    const license = d.licenses as unknown as LicenseJoin | null;

    const lastSeen = d.last_seen_at ? Date.parse(d.last_seen_at) : 0;
    const elapsed = now - lastSeen;
    const wsLive = liveSet.has(d.engine_id);

    const connectionState =
      wsLive || elapsed < ONLINE_MS ? "online"
      : elapsed < DEGRADED_MS      ? "degraded"
      : "offline";

    return {
      id: d.id,
      engine_id: d.engine_id,
      device_name: d.device_name,
      engine_version: d.engine_version,
      platform: d.platform,
      status: d.status,
      activated_at: d.activated_at,
      last_seen_at: d.last_seen_at,
      license_id: d.license_id,
      license_status: license?.status ?? null,
      license_expires_at: license?.expires_at ?? null,
      owner_user_id: license?.owner_user_id ?? null,
      owner_email: license?.owner_user_id ? (emailMap[license.owner_user_id] ?? license.owner_user_id) : null,
      connection_state: connectionState,
    };
  });

  return NextResponse.json(rows);
}
