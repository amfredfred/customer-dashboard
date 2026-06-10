import { verifyAdmin } from "../../_shared/auth";
import type { Env } from "../../_shared/auth";

export const onRequestGet: (ctx: { request: Request; env: Env }) => Promise<Response> = async ({ request, env }) => {
  const auth = await verifyAdmin(request, env);
  if (auth instanceof Response) return auth;
  return Response.json({ email: auth.email, isAdmin: true });
};
