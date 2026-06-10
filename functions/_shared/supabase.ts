import { createClient } from "@supabase/supabase-js";
import type { Env } from "./auth";

export function getAdminSupabase(env: Env) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
