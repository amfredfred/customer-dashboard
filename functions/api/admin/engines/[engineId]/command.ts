import { verifyAdmin, gatewayHttpUrl, gatewayAdminKey } from "../../../../_shared/auth";
import type { Env } from "../../../../_shared/auth";

export const onRequestPost: (ctx: { request: Request; env: Env; params: Record<string, string> }) => Promise<Response> = async ({ request, env, params }) => {
  const auth = await verifyAdmin(request, env);
  if (auth instanceof Response) return auth;

  const body = await request.json() as { command_type?: string };
  const res = await fetch(`${gatewayHttpUrl(env)}/admin/commands`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-key": gatewayAdminKey(env) },
    body: JSON.stringify({ engine_id: params.engineId, command_type: body.command_type }),
  });
  return Response.json(await res.json().catch(() => ({})), { status: res.ok ? 201 : res.status });
};
