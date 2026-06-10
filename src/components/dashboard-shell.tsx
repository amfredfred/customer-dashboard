"use client";

import {
  DashboardIcon, SignalIcon, ExecutionIcon, EngineIcon,
  LicenseKeyIcon, InstallIcon,
} from "@/components/icons";
import { CreditCard, LogOut, Menu, Shield, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./auth-provider";
import { useGateway } from "./gateway-provider";
import { getBrowserSupabase } from "@/lib/supabase-singleton";

const NAV_GROUPS = [
  {
    label: "Monitor",
    links: [
      ["/app",           "Overview",           DashboardIcon],
      ["/app/signals",   "Signal Performance", SignalIcon],
      ["/app/execution", "My Execution",       ExecutionIcon],
    ],
  },
  {
    label: "Manage",
    links: [
      ["/app/engines",  "Engines",        EngineIcon],
      ["/app/licenses", "Licenses & Keys", LicenseKeyIcon],
    ],
  },
  {
    label: "Account",
    links: [
      ["/app/billing",   "Billing",   CreditCard],
      ["/app/downloads", "Downloads", InstallIcon],
    ],
  },
] as const;


function SidebarContent({
  path,
  session,
  planName,
  isAdmin,
  onNav,
  signOut,
}: {
  path: string;
  session: { user: { email?: string } } | null;
  planName: string;
  isAdmin: boolean;
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

      <nav className="py-3 flex-1 overflow-y-auto space-y-4">
        {NAV_GROUPS.map(({ label, links }) => (
          <div key={label}>
            <div className="px-4 mb-1 text-[10px] font-bold uppercase tracking-[.12em] muted">
              {label}
            </div>
            {links.map(([href, linkLabel, Icon]) => {
              const active = path === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNav}
                  className={`nav-link mx-1 my-1${active ? " active" : ""}`}
                >
                  <Icon size={18} />
                  {linkLabel}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {isAdmin && (
        <div className="px-1 pb-1 border-t border-white/[.07] pt-2">
          <Link
            href="/admin"
            onClick={onNav}
            className={`nav-link mx-0 my-1${path.startsWith("/admin") ? " active" : ""}`}
            style={{ color: path.startsWith("/admin") ? "#f43f5e" : undefined }}
          >
            <Shield size={16} style={{ color: path.startsWith("/admin") ? "#f43f5e" : "currentColor" }} />
            Admin Panel
          </Link>
        </div>
      )}

      <div className="p-3 border-t border-white/[.07] shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg"
             style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" }}>
          {/* Avatar initial */}
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0"
               style={{ background: "rgba(61,220,151,.12)", color: "#3ddc97", border: "1px solid rgba(61,220,151,.2)" }}>
            {session?.user.email?.[0]?.toUpperCase() ?? "?"}
          </div>

          {/* Email + badge */}
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium truncate" style={{ color: "rgba(255,255,255,.75)" }}>
              {session?.user.email ?? "Preview mode"}
            </div>
            {planName && (
              <div className="text-[9px] font-semibold mt-0.5 tracking-wide"
                   style={{ color: "#3ddc97" }}>
                ● {planName}
              </div>
            )}
          </div>

          {/* Sign out */}
          {session && (
            <button
              onClick={signOut}
              title="Sign out"
              className="shrink-0 muted hover:text-white transition-colors"
            >
              <LogOut size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Compact global state chip for the top status bar. */
function StatusChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "danger" | "neutral";
}) {
  const dot =
    tone === "success" ? "dot-live"
    : tone === "warning" ? "dot-warn pulse"
    : tone === "danger" ? "dot-dead"
    : "dot-muted";
  return (
    <span className="statusbar-chip">
      <span className={`dot ${dot}`} />
      {label} <b>{value}</b>
    </span>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { session, signOut } = useAuth();
  const {
    status: gwStatus,
    signalMetrics,
    executionMetrics,
    executionMetricsError,
    setSignalMetricsSubscribed,
    setExecutionMetricsEngine,
  } = useGateway();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [planName, setPlanName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeEngineId, setActiveEngineId] = useState<string | null>(null);
  const supabase = getBrowserSupabase();
  const fetchedRef = useRef(false);

  /* One-time fetch: plan badge + first active engine + admin flag */
  useEffect(() => {
    if (!supabase || !session || fetchedRef.current) return;
    fetchedRef.current = true;
    void Promise.all([
      supabase.from("licenses").select("id,status").eq("status", "active").limit(1),
      supabase.from("engine_devices").select("engine_id").eq("status", "active")
        .order("activated_at", { ascending: false }).limit(1),
      // Check admin access silently - 403 is expected for non-admins
      session.access_token
        ? fetch("/api/admin/me", { headers: { Authorization: `Bearer ${session.access_token}` } })
            .then((r) => r.ok)
            .catch(() => false)
        : Promise.resolve(false),
    ]).then(([licResult, devResult, adminOk]) => {
      if (licResult.data?.[0]) setPlanName("Licensed");
      const engineId = (devResult.data?.[0] as { engine_id: string } | undefined)?.engine_id ?? null;
      if (engineId) setActiveEngineId(engineId);
      if (adminOk === true) setIsAdmin(true);
    });
  }, [supabase, session]);

  /* Signal metrics - always subscribed while gateway is authenticated. */
  useEffect(() => {
    if (gwStatus !== "authenticated") return;
    setSignalMetricsSubscribed(true);
  }, [gwStatus, setSignalMetricsSubscribed]);

  /* Execution metrics - subscribe to the first active engine. */
  useEffect(() => {
    if (gwStatus === "authenticated" && activeEngineId) {
      setExecutionMetricsEngine(activeEngineId);
    }
  }, [gwStatus, activeEngineId, setExecutionMetricsEngine]);

  return (
    <div className="min-h-screen md:h-screen md:flex overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 bg-[var(--surface-1)] border-r border-[var(--line-soft)] flex-col">
        <SidebarContent
          path={path}
          session={session}
          planName={planName}
          isAdmin={isAdmin}
          signOut={() => void signOut()}
        />
      </aside>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 flex md:hidden"
          onClick={() => setDrawerOpen(false)}
        >
          <div className="absolute inset-0 bg-black/55" />
          <aside
            className="relative w-72 bg-[var(--surface-1)] border-r border-[var(--line-soft)] flex flex-col h-full z-50"
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
              isAdmin={isAdmin}
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

        {/* Global state bar */}
        <div className="statusbar">
          <StatusChip
            label="Gateway"
            value={
              gwStatus === "authenticated" ? "online"
              : gwStatus === "connecting" ? "connecting"
              : gwStatus === "rejected" ? "rejected"
              : "offline"
            }
            tone={
              gwStatus === "authenticated" ? "success"
              : gwStatus === "connecting" ? "warning"
              : gwStatus === "rejected" ? "danger"
              : "neutral"
            }
          />
          <StatusChip
            label="Signals"
            value={signalMetrics ? "live" : gwStatus === "authenticated" ? "waiting" : "-"}
            tone={signalMetrics ? "success" : gwStatus === "authenticated" ? "warning" : "neutral"}
          />
          <StatusChip
            label="Execution"
            value={
              executionMetricsError ? "forbidden"
              : executionMetrics ? "live"
              : activeEngineId ? "waiting"
              : "no engine"
            }
            tone={
              executionMetricsError ? "danger"
              : executionMetrics ? "success"
              : activeEngineId ? "warning"
              : "neutral"
            }
          />
          <StatusChip
            label="License"
            value={planName ? "active" : "none"}
            tone={planName ? "success" : "neutral"}
          />
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
