import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, gatewayHttpUrl, gatewayAdminKey } from "@/lib/admin-auth";

/**
 * POST /api/admin/engines/[engineId]/command
 * Dispatches a remote command to any engine via the gateway admin endpoint.
 * Body: { command_type: "command.pause"|"command.resume"|"command.emergency_stop" }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ engineId: string }> },
) {
  const auth = await verifyAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { engineId } = await params;
  const body = await req.json() as { command_type?: string };

  const res = await fetch(`${gatewayHttpUrl()}/admin/commands`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": gatewayAdminKey(),
    },
    body: JSON.stringify({ engine_id: engineId, command_type: body.command_type }),
  });

  const responseBody = await res.json().catch(() => ({}));
  return NextResponse.json(responseBody, { status: res.ok ? 201 : res.status });
}
