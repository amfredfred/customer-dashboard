import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export — every page is "use client", no server runtime needed.
  // Cloudflare Pages serves the generated `out/` directory directly.
  output: "export",

  // Disable React StrictMode's double-invocation in dev — prevents the
  // Supabase "multiple GoTrueClient instances" warning from auth-provider.tsx.
  reactStrictMode: false,
};

export default nextConfig;
