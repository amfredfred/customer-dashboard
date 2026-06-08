"use client";

import {
  Activity, CreditCard, KeyRound, LayoutDashboard, LogOut,
  Menu, RadioTower, Server, X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./auth-provider";
import { useGateway } from "./gateway-provider";
import { getBrowserSupabase } from "@/lib/supabase-singleton";

const NAV = [
  ["/app",           "Overview",          LayoutDashboard],
  ["/app/signals",   "Signal Performance", RadioTower],
  ["/app/execution", "My Execution",       Activity],
  ["/app/engines",   "Engines",            Server],
  ["/app/licenses",  "Licenses & Keys",    KeyRound],
  ["/app/billing",   "Billing",            CreditCard],
] as const;


function SidebarContent({
  path,
  session,
  planName,
  onNav,
  signOut,
}: {
  path: string;
  session: { user: { email?: string } } | null;
  planName: string;
  onNav?: () => void;
  signOut: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="h-16 px-5 flex items-center gap-3 border-b border-white/[.07] shrink-0">
        <img src="/icon.png" alt="Apex" className="w-8 h-8 rounded-lg" />
        <div>
          <div className="text-xs font-bold tracking-[.15em]">APEX</div>
          <div className="text-[10px] muted">Control plane</div>
        </div>
      </div>

      <nav className="py-3 flex-1 overflow-y-auto">
        {NAV.map(([href, label, Icon]) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNav}
              className={`nav-link mx-1 my-0.5${active ? " active" : ""}`}
            >
              <Icon size={14} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/[.07] shrink-0">
        {planName && (
          <div className="mb-3">
            <span className="badge badge-green">{planName}</span>
          </div>
        )}
        <div className="text-[11px] truncate muted">
          {session?.user.email ?? "Preview mode"}
        </div>
        {session && (
          <button
            onClick={signOut}
            className="mt-3 text-xs flex items-center gap-2 muted hover:text-white transition-colors"
          >
            <LogOut size={12} /> Sign out
          </button>
        )}
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { session, signOut } = useAuth();
  const { status: gwStatus, setSignalMetricsSubscribed, setExecutionMetricsEngine } = useGateway();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [planName, setPlanName] = useState("");
  const [activeEngineId, setActiveEngineId] = useState<string | null>(null);
  const supabase = getBrowserSupabase();
  const fetchedRef = useRef(false);

  /* One-time fetch: plan badge + first active engine for subscription */
  useEffect(() => {
    if (!supabase || !session || fetchedRef.current) return;
    fetchedRef.current = true;
    void Promise.all([
      supabase.from("licenses").select("id,status").eq("status", "active").limit(1),
      supabase.from("engine_devices").select("engine_id").eq("status", "active")
        .order("activated_at", { ascending: false }).limit(1),
    ]).then(([licResult, devResult]) => {
      if (licResult.data?.[0]) setPlanName("Licensed");
      const engineId = (devResult.data?.[0] as { engine_id: string } | undefined)?.engine_id ?? null;
      if (engineId) setActiveEngineId(engineId);
    });
  }, [supabase, session]);

  /* Signal metrics — always subscribed while gateway is authenticated.
     No cleanup: shell never unmounts, subscription must survive navigation. */
  useEffect(() => {
    if (gwStatus !== "authenticated") return;
    setSignalMetricsSubscribed(true);
  }, [gwStatus, setSignalMetricsSubscribed]);

  /* Execution metrics — subscribe to the first active engine.
     No cleanup: let the subscription persist across page changes.
     The execution page can call setExecutionMetricsEngine directly when
     the user switches engines; the shell re-anchors on reconnect. */
  useEffect(() => {
    if (gwStatus === "authenticated" && activeEngineId) {
      setExecutionMetricsEngine(activeEngineId);
    }
  }, [gwStatus, activeEngineId, setExecutionMetricsEngine]);

  return (
    <div className="min-h-screen md:h-screen md:flex overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 bg-[#0b0d10] border-r border-white/[.07] flex-col">
        <SidebarContent
          path={path}
          session={session}
          planName={planName}
          signOut={() => void signOut()}
        />
      </aside>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 flex md:hidden"
          onClick={() => setDrawerOpen(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <aside
            className="relative w-72 bg-[#0b0d10] border-r border-white/[.07] flex flex-col h-full z-50"
            onClick={e => e.stopPropagation()}
          >
            <button
              className="absolute top-4 right-4 muted hover:text-white"
              onClick={() => setDrawerOpen(false)}
            >
              <X size={18} />
            </button>
            <SidebarContent
              path={path}
              session={session}
              planName={planName}
              onNav={() => setDrawerOpen(false)}
              signOut={() => { void signOut(); setDrawerOpen(false); }}
            />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col md:h-screen overflow-hidden">
        {/* Mobile: hamburger bar */}
        <div className="md:hidden h-14 px-4 border-b border-white/[.07] flex items-center shrink-0 bg-[#08090bee] backdrop-blur sticky top-0 z-10">
          <button
            className="muted hover:text-white"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <img src="/icon.png" alt="Apex" className="w-6 h-6 ml-3" />
          <span className="text-xs font-bold tracking-[.15em] ml-2">APEX</span>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
