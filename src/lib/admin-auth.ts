import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Verifies that the request comes from an authenticated admin user.
 *
 * - Reads the Bearer token from Authorization header
 * - Verifies it against Supabase (service role)
 * - Checks the email is in the ADMIN_EMAILS env var
 *
 * Returns the user email on success or a 401/403 NextResponse on failure.
 */
export async function verifyAdmin(
  req: NextRequest,
): Promise<{ email: string } | NextResponse> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ error: "Missing Authorization" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const email = data.user.email ?? "";
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!allowed.includes(email.toLowerCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { email };
}

/** Returns the raw gateway HTTP base URL from env. */
export function gatewayHttpUrl(): string {
  return (
    process.env.GATEWAY_HTTP_URL ??
    process.env.NEXT_PUBLIC_GATEWAY_WS_URL
      ?.replace(/^wss:/, "https:")
      .replace(/^ws:/, "http:")
      .replace(/\/dashboard$/, "") ??
    "https://apex-gateway.somicast.com"
  );
}

/** Returns the admin key for gateway calls. */
export function gatewayAdminKey(): string {
  return process.env.GATEWAY_ADMIN_KEY ?? "";
}
