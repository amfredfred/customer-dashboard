"use client";

import { SignalIcon, ExecutionIcon } from "@/components/icons";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSignalEngine } from "./signal-engine-provider";
import { useExecutionEngine } from "./execution-engine-provider";

const NAV_LINKS = [
  ["/app/signals",   "Signal Performance", SignalIcon],
  ["/app/execution", "My Execution",       ExecutionIcon],
] as const;

function SidebarContent({ path, onNav }: { path: string; onNav?: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="h-16 px-5 flex items-center gap-3 border-b border-white/[.07] shrink-0">
        <img src="/icon.png" alt="Apex" className="w-8 h-8 rounded-lg" />
        <div>
          <div className="text-xs font-bold tracking-[.15em]">APEX</div>
          <div className="text-[10px] muted">Live monitor</div>
        </div>
      </div>

      <nav className="py-3 flex-1 overflow-y-auto space-y-1">
        {NAV_LINKS.map(([href, label, Icon]) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNav}
              className={`nav-link mx-1 my-1${active ? " active" : ""}`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
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
  const signalEngine = useSignalEngine();
  const executionEngine = useExecutionEngine();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen md:h-screen md:flex overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 bg-[var(--surface-1)] border-r border-[var(--line-soft)] flex-col">
        <SidebarContent path={path} />
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
