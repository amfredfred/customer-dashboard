import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: `output: "export"` (static export for Cloudflare Pages) was removed.
  // The admin panel's /api/admin/* route handlers require a Node server
  // runtime — Next 16 rejects API routes under static export in both dev and
  // build, which broke `next build` and made /admin unreachable (every
  // /api/admin/me check failed and redirected back to /app).
  // Deploy with a server runtime (`next start`, Vercel, or a Cloudflare
  // Workers adapter such as OpenNext) instead of serving `out/` statically.

  // Disable React StrictMode's double-invocation in dev - prevents the
  // Supabase "multiple GoTrueClient instances" warning from auth-provider.tsx.
  reactStrictMode: false,

  output: "export",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
