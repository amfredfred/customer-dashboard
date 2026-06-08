"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { GatewayProvider } from "@/components/gateway-provider";

function AppLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8"
         style={{ background: "var(--bg)" }}>

      {/* Logo mark */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          {/* outer pulse ring */}
          <div className="absolute inset-0 rounded-2xl animate-ping"
               style={{ background: "rgba(61,220,151,.12)", animationDuration: "1.8s" }} />
          <img src="/icon.png" alt="Apex" className="relative w-14 h-14 rounded-2xl"
               style={{ boxShadow: "0 0 0 1px rgba(255,255,255,.08), 0 8px 32px rgba(0,0,0,.4)" }} />
        </div>

        <div className="text-center">
          <div className="text-sm font-bold tracking-[.18em] uppercase"
               style={{ color: "var(--text)" }}>Apex</div>
          <div className="text-[11px] tracking-[.08em] mt-0.5"
               style={{ color: "var(--muted)" }}>Quant Trader</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-32 h-px rounded-full overflow-hidden"
           style={{ background: "rgba(255,255,255,.07)" }}>
        <div className="h-full rounded-full animate-[loading-bar_1.6s_ease-in-out_infinite]"
             style={{ background: "linear-gradient(90deg, transparent, #3ddc97, transparent)", width: "60%" }} />
      </div>
    </div>
  );
}

function Guard({ children }: { children: React.ReactNode }) {
  const { session, loading, configured } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && configured && !session) router.replace("/login");
  }, [session, loading, configured, router]);

  if (loading) return <AppLoader />;

  return (
    <GatewayProvider>
      <DashboardShell>{children}</DashboardShell>
    </GatewayProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Guard>{children}</Guard>
    </AuthProvider>
  );
}
