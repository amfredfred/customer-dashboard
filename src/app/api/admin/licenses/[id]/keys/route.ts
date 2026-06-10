import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, gatewayHttpUrl, gatewayAdminKey } from "@/lib/admin-auth";

async function callGateway(method: string, path: string) {
  const res = await fetch(`${gatewayHttpUrl()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": gatewayAdminKey(),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

/**
 * POST /api/admin/licenses/[id]/keys
 * Issues (or rotates) the activation key via the gateway admin endpoint.
 * Returns { key: "TR-..." } exactly once.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const { ok, status, body } = await callGateway("POST", `/admin/licenses/${id}/keys`);
  return NextResponse.json(body, { status: ok ? 201 : status });
}

/**
 * DELETE /api/admin/licenses/[id]/keys
 * Revokes the activation key via the gateway admin endpoint.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const { ok, status, body } = await callGateway("DELETE", `/admin/licenses/${id}/keys`);
  if (ok) return new NextResponse(null, { status: 204 });
  return NextResponse.json(body, { status });
}
