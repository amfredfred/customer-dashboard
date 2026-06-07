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
import { createBrowserSupabase } from "@/lib/supabase";

const NAV = [
  ["/app",           "Overview",          LayoutDashboard],
  ["/app/signals",   "Signal Performance", RadioTower],
  ["/app/execution", "My Execution",       Activity],
  ["/app/engines",   "Engines",            Server],
  ["/app/licenses",  "Licenses & Keys",    KeyRound],
  ["/app/billing",   "Billing",            CreditCard],
] as const;

function StatusPill({
  dot,
  label,
}: {
  dot: "live" | "warn" | "dead" | "muted";
  label: string;
}) {
  return (
    <span className="pill">
      <span className={`dot dot-${dot}${dot === "live" ? " pulse" : ""}`} />
      {label}
    </span>
  );
}

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
        <div className="w-8 h-8 rounded-lg border border-white/10 grid place-items-center mono text-xs font-bold text-[#3ddc97]">
          TR
        </div>
        <div>
          <div className="text-xs font-bold tracking-[.15em]">TRADERELAY</div>
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
  const gateway = useGateway();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [planName, setPlanName] = useState("");
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!supabase || !session || fetchedRef.current) return;
    fetchedRef.current = true;
    void supabase
      .from("licenses")
      .select("id,status")
      .eq("status", "active")
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) setPlanName("Licensed");
      });
  }, [supabase, session]);

  const gwReady   = gateway.status === "authenticated";
  const gwConnecting = gateway.status === "connecting";
  const gwLabel = gwReady
    ? "Gateway Online"
    : gwConnecting
    ? "Gateway Connecting"
    : gateway.status === "rejected"
    ? "Gateway Rejected"
    : "Gateway Offline";
  const gwDot: "live" | "warn" | "dead" =
    gwReady ? "live" : gwConnecting ? "warn" : "dead";

  const sigLive = gwReady && Boolean(gateway.signalMetrics);
  const exLive  = gwReady && Boolean(gateway.executionMetrics);

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
        {/* Top bar */}
        <header className="h-14 px-4 md:px-6 border-b border-white/[.07] flex items-center justify-between shrink-0 bg-[#08090bee] backdrop-blur sticky top-0 z-10">
          {/* Mobile: hamburger + logo */}
          <div className="flex items-center gap-3 md:hidden">
            <button
              className="muted hover:text-white"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <span className="text-xs font-bold tracking-[.15em]">TRADERELAY</span>
          </div>

          {/* Desktop: gateway status */}
          <div
            className="hidden md:flex items-center gap-1.5 text-xs font-semibold"
            title={gateway.error ?? undefined}
          >
            <span className={`dot dot-${gwDot}${gwReady ? " pulse" : ""}`} />
            <span
              className={
                gwReady
                  ? "text-[#3ddc97]"
                  : gwConnecting
                  ? "text-[#f5b942]"
                  : "text-[#f43f5e]"
              }
            >
              {gwLabel}
            </span>
          </div>

          {/* Right pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <StatusPill
              dot={sigLive ? "live" : gwReady ? "muted" : "dead"}
              label={sigLive ? "Signals Live" : "Signals Idle"}
            />
            <StatusPill
              dot={exLive ? "live" : "muted"}
              label={exLive ? "Execution Live" : "Execution Private"}
            />
            {planName && (
              <span className="pill hidden sm:inline-flex">
                {planName}
              </span>
            )}
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
