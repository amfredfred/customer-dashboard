import { createClient } from "@supabase/supabase-js";

export interface Env {
  NEXT_PUBLIC_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ADMIN_EMAILS: string;
  GATEWAY_HTTP_URL?: string;
  NEXT_PUBLIC_GATEWAY_WS_URL?: string;
  GATEWAY_ADMIN_KEY?: string;
}

export async function verifyAdmin(req: Request, env: Env): Promise<{ email: string } | Response> {
  const token = (req.headers.get("authorization") ?? "").replace(/^bearer\s+/i, "").trim();
  if (!token) return Response.json({ error: "Missing Authorization" }, { status: 401 });

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
    return Response.json({ error: "Server misconfigured" }, { status: 500 });

  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return Response.json({ error: "Invalid token" }, { status: 401 });

  const email = data.user.email ?? "";
  const allowed = (env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!allowed.includes(email.toLowerCase())) return Response.json({ error: "Forbidden" }, { status: 403 });

  return { email };
}

export function gatewayHttpUrl(env: Env): string {
  return (
    env.GATEWAY_HTTP_URL ??
    env.NEXT_PUBLIC_GATEWAY_WS_URL
      ?.replace(/^wss:/, "https:").replace(/^ws:/, "http:").replace(/\/dashboard$/, "") ??
    "https://apex-gateway.somicast.com"
  );
}

export function gatewayAdminKey(env: Env): string {
  return env.GATEWAY_ADMIN_KEY ?? "";
}
