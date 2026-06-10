"use client";

import { EngineIcon, LicenseKeyIcon, DashboardIcon } from "@/components/icons";
import { LogOut, Menu, Shield, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./auth-provider";

const NAV = [
  ["/admin",          "Overview",  DashboardIcon],
  ["/admin/licenses", "Licenses",  LicenseKeyIcon],
  ["/admin/engines",  "Engines",   EngineIcon],
] as const;

function SidebarContent({
  path,
  email,
  onNav,
  signOut,
}: {
  path: string;
  email: string;
  onNav?: () => void;
  signOut: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-16 px-5 flex items-center gap-3 border-b border-white/[.07] shrink-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
             style={{ background: "rgba(244,63,94,.12)", border: "1px solid rgba(244,63,94,.25)" }}>
          <Shield size={15} style={{ color: "#f43f5e" }} />
        </div>
        <div>
          <div className="text-xs font-bold tracking-[.15em]">APEX</div>
          <div className="text-[10px] muted">Admin panel</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="py-4 flex-1 overflow-y-auto">
        <div className="px-4 mb-2 text-[10px] font-bold uppercase tracking-[.12em] muted">
          Admin
        </div>
        {NAV.map(([href, label, Icon]) => {
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

        {/* Back to customer dashboard */}
        <div className="mx-1 mt-4 border-t border-white/[.07] pt-3">
          <Link href="/app" className="nav-link my-1" onClick={onNav}>
            <DashboardIcon size={18} />
            <span style={{ color: "var(--muted)" }}>Back to Dashboard</span>
          </Link>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/[.07] shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg"
             style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" }}>
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0"
               style={{ background: "rgba(244,63,94,.12)", color: "#f43f5e", border: "1px solid rgba(244,63,94,.2)" }}>
            {email[0]?.toUpperCase() ?? "A"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium truncate" style={{ color: "rgba(255,255,255,.75)" }}>
              {email}
            </div>
            <div className="text-[9px] font-semibold mt-0.5 tracking-wide"
                 style={{ color: "#f43f5e" }}>
              ● Administrator
            </div>
          </div>
          <button onClick={signOut} title="Sign out" className="shrink-0 muted hover:text-white transition-colors">
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { session, signOut } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const email = session?.user.email ?? "";

  return (
    <div className="min-h-screen md:h-screen md:flex overflow-hidden">
      {/* Admin accent bar */}
      <div className="fixed top-0 left-0 right-0 h-px z-50"
           style={{ background: "linear-gradient(90deg, transparent, #f43f5e 40%, #f43f5e 60%, transparent)" }} />

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 bg-[var(--surface-1)] border-r border-[var(--line-soft)] flex-col">
        <SidebarContent path={path} email={email} signOut={() => void signOut()} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/55" />
          <aside
            className="relative w-72 bg-[var(--surface-1)] border-r border-[var(--line-soft)] flex flex-col h-full z-50"
            onClick={e => e.stopPropagation()}
          >
            <button className="absolute top-4 right-4 muted hover:text-white" onClick={() => setDrawerOpen(false)}>
              <X size={18} />
            </button>
            <SidebarContent
              path={path}
              email={email}
              onNav={() => setDrawerOpen(false)}
              signOut={() => { void signOut(); setDrawerOpen(false); }}
            />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col md:h-screen overflow-hidden">
        {/* Mobile hamburger */}
        <div className="md:hidden h-14 px-4 border-b border-white/[.07] flex items-center shrink-0 bg-[#08090bee] backdrop-blur sticky top-0 z-10">
          <button className="muted hover:text-white" onClick={() => setDrawerOpen(true)} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <Shield size={15} className="ml-3" style={{ color: "#f43f5e" }} />
          <span className="text-xs font-bold tracking-[.15em] ml-2">ADMIN</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
