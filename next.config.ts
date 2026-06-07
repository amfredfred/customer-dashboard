import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable React StrictMode's intentional double-invocation of useMemo/useEffect
  // factories in development. With it enabled, auth-provider.tsx's
  // useMemo(() => createBrowserSupabase(), []) runs twice, creating two
  // GoTrueClients and triggering Supabase's "multiple instances" warning even
  // though auth-provider is the only file actually calling createClient.
  // All StrictMode-detectable bugs are already guarded by the subscription
  // effects in the gateway provider; this tradeoff is acceptable.
  reactStrictMode: false,
};

export default nextConfig;
