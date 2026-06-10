import { verifyAdmin, gatewayHttpUrl, gatewayAdminKey } from "../../../../_shared/auth";
import type { Env } from "../../../../_shared/auth";

async function callGateway(method: string, path: string, env: Env) {
  const res = await fetch(`${gatewayHttpUrl(env)}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-admin-key": gatewayAdminKey(env) },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export const onRequestPost: (ctx: { request: Request; env: Env; params: Record<string, string> }) => Promise<Response> = async ({ request, env, params }) => {
  const auth = await verifyAdmin(request, env);
  if (auth instanceof Response) return auth;
  const { ok, status, body } = await callGateway("POST", `/admin/licenses/${params.id}/keys`, env);
  return Response.json(body, { status: ok ? 201 : status });
};

export const onRequestDelete: (ctx: { request: Request; env: Env; params: Record<string, string> }) => Promise<Response> = async ({ request, env, params }) => {
  const auth = await verifyAdmin(request, env);
  if (auth instanceof Response) return auth;
  const { ok, status, body } = await callGateway("DELETE", `/admin/licenses/${params.id}/keys`, env);
  if (ok) return new Response(null, { status: 204 });
  return Response.json(body, { status });
};
