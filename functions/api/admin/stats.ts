import { verifyAdmin } from "../../_shared/auth";
import { getAdminSupabase } from "../../_shared/supabase";
import type { Env } from "../../_shared/auth";

export const onRequestGet: (ctx: { request: Request; env: Env }) => Promise<Response> = async ({ request, env }) => {
  const auth = await verifyAdmin(request, env);
  if (auth instanceof Response) return auth;

  const sb = getAdminSupabase(env);

  const [licRes, devRes, sesRes] = await Promise.all([
    sb.from("licenses").select("status"),
    sb.from("engine_devices").select("status, engine_version"),
    sb.from("engine_sessions").select("id").is("disconnected_at", null)
      .gte("last_heartbeat_at", new Date(Date.now() - 2 * 60 * 1000).toISOString()),
  ]);

  const licenses = licRes.data ?? [];
  const devices = devRes.data ?? [];
  const activeSessions = sesRes.data?.length ?? 0;

  const byStatus = (arr: { status: string }[], s: string) => arr.filter((x) => x.status === s).length;

  return Response.json({
    licenses: { total: licenses.length, active: byStatus(licenses, "active"), suspended: byStatus(licenses, "suspended"), expired: byStatus(licenses, "expired") },
    devices: { total: devices.length, active: byStatus(devices, "active") },
    connectedEngines: activeSessions,
  });
};
