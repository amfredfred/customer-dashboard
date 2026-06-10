import { verifyAdmin } from "../../../../_shared/auth";
import { getAdminSupabase } from "../../../../_shared/supabase";
import type { Env } from "../../../../_shared/auth";

export const onRequestPatch: (ctx: { request: Request; env: Env; params: Record<string, string> }) => Promise<Response> = async ({ request, env, params }) => {
  const auth = await verifyAdmin(request, env);
  if (auth instanceof Response) return auth;

  const body = await request.json() as { status?: string; expires_at?: string | null };
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status !== undefined) updates.status = body.status;
  if (body.expires_at !== undefined) updates.expires_at = body.expires_at;

  const sb = getAdminSupabase(env);
  const { error } = await sb.from("licenses").update(updates).eq("id", params.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
};
