"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, SectionHead } from "@/components/metric-detail";
import { StatCard } from "@/components/stat-card";
import { getBrowserSupabase } from "@/lib/supabase-singleton";
import { RefreshIcon } from "@/components/icons";

type Stats = {
  licenses: { total: number; active: number; suspended: number; expired: number };
  devices:  { total: number; active: number };
  connectedEngines: number;
};

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getBrowserSupabase();
      const { data: { session } } = await supabase!.auth.getSession();
      const token = session?.access_token ?? "";
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      setStats(await res.json() as Stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="Admin"
        title="System Overview"
        description="Platform-wide license and engine health at a glance."
        right={
          <button className="btn btn-ghost btn-sm" onClick={() => void load()}>
            <RefreshIcon size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        }
      />

      {error && (
        <div className="surface mb-6 p-4 text-sm" style={{ borderColor: "var(--danger-border)", color: "var(--danger)" }}>
          {error}
        </div>
      )}

      <SectionHead label="Licenses" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total"     value={stats ? String(stats.licenses.total)     : "-"} />
        <StatCard label="Active"    value={stats ? String(stats.licenses.active)    : "-"} tone={stats && stats.licenses.active > 0 ? "good" : "normal"} />
        <StatCard label="Suspended" value={stats ? String(stats.licenses.suspended) : "-"} tone={stats && stats.licenses.suspended > 0 ? "warn" : "normal"} />
        <StatCard label="Expired"   value={stats ? String(stats.licenses.expired)   : "-"} tone={stats && stats.licenses.expired > 0 ? "danger" : "normal"} />
      </div>

      <SectionHead label="Execution Engines" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <StatCard label="Registered Devices" value={stats ? String(stats.devices.total)          : "-"} />
        <StatCard label="Active Devices"     value={stats ? String(stats.devices.active)         : "-"} tone={stats && stats.devices.active > 0 ? "good" : "normal"} />
        <StatCard label="Live WS Connections" value={stats ? String(stats.connectedEngines) : "-"} tone={stats && stats.connectedEngines > 0 ? "good" : "normal"} />
      </div>

      <SectionHead label="Quick links" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <a href="/admin/licenses" className="surface p-4 hover:border-white/20 transition-colors block">
          <div className="text-sm font-semibold mb-1">License Management</div>
          <div className="text-xs muted">View all licenses, suspend, extend expiry, rotate keys</div>
        </a>
        <a href="/admin/engines" className="surface p-4 hover:border-white/20 transition-colors block">
          <div className="text-sm font-semibold mb-1">Engine Management</div>
          <div className="text-xs muted">Monitor all connected engines, dispatch remote commands</div>
        </a>
      </div>
    </div>
  );
}
