import { getBrowserSupabase } from "./supabase-singleton";
import { gatewayHttpBase } from "./gateway";

async function getToken(): Promise<string> {
  const sb = getBrowserSupabase();
  const { data: { session } } = await sb!.auth.getSession();
  return session?.access_token ?? "";
}

export async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getToken();
  return fetch(`${gatewayHttpBase()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
}
