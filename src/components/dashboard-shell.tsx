"use client";

import { Radio, Cpu, Menu, X, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSignalEngine } from "./signal-engine-provider";
import { useExecutionEngine } from "./execution-engine-provider";

const NAV_GROUPS = [
  {
    label: "Monitoring",
    links: [
      ["/app/signals",   "Signal Performance", Radio],
      ["/app/execution", "My Execution",       Cpu],
    ],
  },
] as const;

const PAGE_TITLES: Record<string, string> = {
  "/app/signals":   "Signal Performance",
  "/app/execution": "My Execution",
};

const COLLAPSE_KEY = "apex.sidebar.collapsed";

/** Reads config.trading.env ("paper" | "live") out of the signal engine's metrics snapshot. */
function readTradingEnv(metrics: Record<string, unknown> | null): string | null {
  const config = metrics?.config as Record<string, unknown> | undefined;
  const trading = config?.trading as Record<string, unknown> | undefined;
  const env = trading?.env;
  return typeof env === "string" && env ? env : null;
}

function SidebarContent({
  path,
  collapsed = false,
  onNav,
}: {
  path: string;
  collapsed?: boolean;
  onNav?: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="h-16 px-5 flex items-center gap-3 border-b border-white/[.07] shrink-0">
        <img src="/icon.png" alt="Apex" className="w-8 h-8 rounded-lg shrink-0" />
        <div className="sidebar-brand-text min-w-0">
          <div className="text-xs font-bold tracking-[.15em]">APEX</div>
          <div className="text-[10px] muted">Live monitor</div>
        </div>
      </div>

      <nav className="py-4 flex-1 overflow-y-auto space-y-4">
        {NAV_GROUPS.map(({ label, links }) => (
          <div key={label}>
            <div className="nav-section-label">{label}</div>
            <div className="space-y-0.5 px-2">
              {links.map(([href, linkLabel, Icon]) => {
                const active = path === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNav}
                    title={collapsed ? linkLabel : undefined}
                    className={`nav-link${active ? " active" : ""}`}
                  >
                    <Icon size={17} strokeWidth={2} />
                    <span className="nav-link-label">{linkLabel}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <SidebarFooter collapsed={collapsed} />
    </div>
  );
}

function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  const { metrics: signalSnap } = useSignalEngine();
  const { engine } = useExecutionEngine();

  const signalVersion = String(signalSnap?.version ?? "-");
  const execVersion = String(engine?.version ?? "-");

  return (
    <div className="p-3 border-t border-white/[.07] shrink-0">
      <div
        className="rounded-lg px-2.5 py-2.5"
        style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" }}
      >
        <div className={`sidebar-footer-detail text-[10px] leading-5 ${collapsed ? "hidden" : ""}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="muted">Signal Engine</span>
            <span className="mono" style={{ color: "var(--text-soft)" }}>v{signalVersion}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="muted">Execution Engine</span>
            <span className="mono" style={{ color: "var(--text-soft)" }}>v{execVersion}</span>
          </div>
        </div>
        {collapsed && (
          <div className="flex justify-center">
            <span className="dot dot-live pulse" style={{ width: 7, height: 7 }} />
          </div>
        )}
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

function EnvironmentBadge({ env }: { env: string | null }) {
  if (!env) return null;
  const kind = env.toLowerCase() === "live" ? "live" : "paper";
  return <span className={`env-badge ${kind}`}>{env}</span>;
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const signalEngine = useSignalEngine();
  const executionEngine = useExecutionEngine();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(COLLAPSE_KEY) : null;
    if (saved === "1") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  };

  const env = readTradingEnv(signalEngine.metrics);
  const pageTitle = PAGE_TITLES[path] ?? "Apex Quantel";

  return (
    <div className="min-h-screen md:h-screen md:flex overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className={`sidebar hidden md:flex shrink-0 bg-[var(--surface-1)] border-r border-[var(--line-soft)] flex-col relative${collapsed ? " collapsed" : ""}`}
        style={{ width: collapsed ? 72 : 256 }}
      >
        <SidebarContent path={path} collapsed={collapsed} />
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-[26px] w-6 h-6 rounded-full flex items-center justify-center transition-colors"
          style={{
            background: "var(--surface-3)",
            border: "1px solid var(--line-strong)",
            color: "var(--muted)",
          }}
        >
          {collapsed ? <PanelLeftOpen size={13} /> : <PanelLeftClose size={13} />}
        </button>
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
            <SidebarContent path={path} onNav={() => setDrawerOpen(false)} />
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

        {/* Top bar: page context + environment */}
        <div
          className="hidden md:flex items-center justify-between h-12 px-6 border-b border-white/[.07] shrink-0"
          style={{ background: "var(--surface-1)" }}
        >
          <span className="text-[13px] font-semibold" style={{ color: "var(--text-soft)" }}>{pageTitle}</span>
          <EnvironmentBadge env={env} />
        </div>

        {/* Global state bar */}
        <div className="statusbar">
          <StatusChip
            label="Signal Engine"
            value={
              signalEngine.status === "connected" ? "online"
              : signalEngine.status === "connecting" ? "connecting"
              : signalEngine.status === "error" ? "error"
              : "offline"
            }
            tone={
              signalEngine.status === "connected" ? "success"
              : signalEngine.status === "connecting" ? "warning"
              : signalEngine.status === "error" ? "danger"
              : "neutral"
            }
          />
          <StatusChip
            label="Execution Engine"
            value={
              executionEngine.status === "connected" ? "online"
              : executionEngine.status === "connecting" ? "connecting"
              : executionEngine.status === "error" ? "error"
              : "offline"
            }
            tone={
              executionEngine.status === "connected" ? "success"
              : executionEngine.status === "connecting" ? "warning"
              : executionEngine.status === "error" ? "danger"
              : "neutral"
            }
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
