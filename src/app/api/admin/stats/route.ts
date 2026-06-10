import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { getAdminSupabase } from "@/lib/admin-supabase";

/** GET /api/admin/stats — system overview counts. */
export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const sb = getAdminSupabase();

  const [licRes, devRes, sesRes] = await Promise.all([
    // Licenses by status
    sb.from("licenses").select("status"),
    // Engine devices by status
    sb.from("engine_devices").select("status, engine_version"),
    // Recent active sessions (connected in last 2 min)
    sb
      .from("engine_sessions")
      .select("id")
      .is("disconnected_at", null)
      .gte(
        "last_heartbeat_at",
        new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      ),
  ]);

  const licenses = licRes.data ?? [];
  const devices = devRes.data ?? [];
  const activeSessions = sesRes.data?.length ?? 0;

  const byStatus = (arr: { status: string }[], s: string) =>
    arr.filter((x) => x.status === s).length;

  return NextResponse.json({
    licenses: {
      total: licenses.length,
      active: byStatus(licenses, "active"),
      suspended: byStatus(licenses, "suspended"),
      expired: byStatus(licenses, "expired"),
    },
    devices: {
      total: devices.length,
      active: byStatus(devices, "active"),
    },
    connectedEngines: activeSessions,
  });
}
