"use client";

import { getBrowserSupabase } from "@/lib/supabase-singleton";
import { PageHeader } from "@/components/metric-detail";
import { AlertCircle, Server } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

/* ── types ────────────────────────────────────────────────────────────── */
type EngineDevice = {
  id: string;
  license_id: string;
  engine_id: string;
  device_name: string;
  platform: Record<string, unknown>;
  engine_version: string;
  status: string;
  activated_at: string;
  last_seen_at: string | null;
};
type License = {
  id: string;
  status: string;
  max_devices: number;
  expires_at: string | null;
};
type EngineSession = {
  engine_device_id: string;
  connected_at: string;
  disconnected_at: string | null;
  disconnect_reason: string | null;
  last_heartbeat_at: string | null;
};
type EngineView = EngineDevice & {
  license?: License;
  symbols: string[];
  session?: EngineSession;
  usedSlots: number;
};

/* ── constants ────────────────────────────────────────────────────────── */
const ONLINE_MS   = 90_000;
const DEGRADED_MS = 300_000;

/* ── helpers ──────────────────────────────────────────────────────────── */
function engineState(
  engine: EngineView,
  nowMs: number
): "online" | "degraded" | "offline" {
  if (engine.status !== "active") return "offline";
  if (engine.license?.status !== "active") return "offline";
  if (!engine.session || engine.session.disconnected_at) return "offline";
  const hb = engine.session.last_heartbeat_at;
  if (!hb || !nowMs) return "offline";
  const age = nowMs - Date.parse(hb);
  if (age <= ONLINE_MS)   return "online";
  if (age <= DEGRADED_MS) return "degraded";
  return "offline";
}

function platformLabel(p: Record<string, unknown>) {
  return [p.os, p.architecture].filter(Boolean).map(String).join(" ") || "Platform unavailable";
}

function timeAgo(value: string | null | undefined, nowMs: number) {
  if (!value) return "Never";
  if (!nowMs) return "Checking…";
  const s = Math.max(0, Math.floor((nowMs - Date.parse(value)) / 1000));
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function StateLabel({ state }: { state: "online" | "degraded" | "offline" }) {
  const dot =
    state === "online"   ? "dot-live pulse"
    : state === "degraded" ? "dot-warn"
    : "dot-dead";
  const label =
    state === "online" ? "Online" : state === "degraded" ? "Degraded" : "Offline";
  return (
    <span className="pill shrink-0">
      <span className={`dot ${dot}`} />
      {label}
    </span>
  );
}

/* ── page ─────────────────────────────────────────────────────────────── */
export default function Engines() {
  const supabase = getBrowserSupabase();
  const [engines, setEngines] = useState<EngineView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [nowMs, setNowMs]     = useState(0);

  const load = useCallback(async () => {
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }
    const devicesResult = await supabase
      .from("engine_devices")
      .select("id,license_id,engine_id,device_name,platform,engine_version,status,activated_at,last_seen_at")
      .order("activated_at", { ascending: false });
    if (devicesResult.error) {
      setError(devicesResult.error.message);
      setLoading(false);
      return;
    }
    const devices   = (devicesResult.data ?? []) as EngineDevice[];
    const licIds    = [...new Set(devices.map(d => d.license_id))];
    const deviceIds = devices.map(d => d.id);

    const [licResult, entResult, sessResult] = await Promise.all([
      licIds.length
        ? supabase.from("licenses").select("id,status,max_devices,expires_at").in("id", licIds)
        : Promise.resolve({ data: [], error: null }),
      licIds.length
        ? supabase.from("license_symbol_entitlements").select("license_id,symbol").in("license_id", licIds)
        : Promise.resolve({ data: [], error: null }),
      deviceIds.length
        ? supabase
            .from("engine_sessions")
            .select("engine_device_id,connected_at,disconnected_at,disconnect_reason,last_heartbeat_at")
            .in("engine_device_id", deviceIds)
            .order("connected_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    const err = licResult.error ?? entResult.error ?? sessResult.error;
    if (err) { setError(err.message); setLoading(false); return; }

    const licenses = new Map((licResult.data as License[]).map(l => [l.id, l]));
    const symbolsByLicense = new Map<string, string[]>();
    for (const item of entResult.data as { license_id: string; symbol: string }[]) {
      symbolsByLicense.set(item.license_id, [...(symbolsByLicense.get(item.license_id) ?? []), item.symbol]);
    }
    const sessions = new Map<string, EngineSession>();
    for (const s of sessResult.data as EngineSession[]) {
      if (!sessions.has(s.engine_device_id)) sessions.set(s.engine_device_id, s);
    }
    const slotsByLicense = new Map<string, number>();
    for (const d of devices) slotsByLicense.set(d.license_id, (slotsByLicense.get(d.license_id) ?? 0) + 1);

    setEngines(devices.map(d => ({
      ...d,
      license:    licenses.get(d.license_id),
      symbols:    symbolsByLicense.get(d.license_id) ?? [],
      session:    sessions.get(d.id),
      usedSlots:  slotsByLicense.get(d.license_id) ?? 0,
    })));
    setError(null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const init  = setTimeout(() => void load(), 0);
    const poll  = setInterval(() => void load(), 30_000);
    const clock = setInterval(() => setNowMs(Date.now()), 10_000);
    setNowMs(Date.now());
    return () => { clearTimeout(init); clearInterval(poll); clearInterval(clock); };
  }, [load]);

  return (
    <div className="page-wrap space-y-4">
      <PageHeader
        eyebrow="Installed engines"
        title="Engines"
        description="Activated execution engines and their latest Gateway session heartbeat. Online = heartbeat within 90 s · Degraded = 90 s–5 min · Offline = >5 min or disconnected."
      />

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="panel overflow-hidden">
              <div className="panel-head">
                <div><div className="skeleton h-4 w-48 mb-2" /><div className="skeleton h-2.5 w-32" /></div>
                <div className="skeleton h-5 w-20 rounded-full" />
              </div>
              <div className="panel-body grid grid-cols-4 gap-5">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j}><div className="skeleton h-2 w-16 mb-2" /><div className="skeleton h-4 w-20" /></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="panel mt-4 p-4 border-[#f43f5e]/30 bg-[#f43f5e]/05">
          <div className="flex items-center gap-2 text-[#f43f5e] text-sm font-semibold">
            <AlertCircle size={14} /> {error}
          </div>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && engines.length === 0 && (
        <div className="panel mt-6 state-block">
          <Server size={28} className="text-white/10 mb-2" />
          <div className="font-medium">No activated execution engines</div>
          <p className="muted text-xs max-w-xs">
            Generate an activation key from Licenses &amp; Keys and connect your engine to start
            streaming private execution metrics.
          </p>
        </div>
      )}

      {/* Engine cards */}
      <div className="space-y-3">
        {engines.map(engine => {
          const state  = engineState(engine, nowMs);
          const maxDev = engine.license?.max_devices ?? 0;
          const licExp = engine.license?.expires_at;

          return (
            <section key={engine.id} className="panel overflow-hidden">
              {/* Card header */}
              <div className="panel-head flex-col sm:flex-row sm:items-start">
                <div>
                  <div className="font-semibold mono text-sm">{engine.engine_id}</div>
                  <div className="text-xs muted mt-0.5">
                    {engine.device_name} · {platformLabel(engine.platform)}
                  </div>
                </div>
                <StateLabel state={state} />
              </div>

              {/* Metrics row */}
              <div className="panel-body grid grid-cols-2 sm:grid-cols-4 gap-5">
                <div>
                  <div className="muted text-xs">Version</div>
                  <div className="mt-2 mono text-xs font-medium">{engine.engine_version || "—"}</div>
                </div>
                <div>
                  <div className="muted text-xs">Symbols</div>
                  <div className="mt-2 mono text-xs font-medium break-words">
                    {engine.symbols.length > 0 ? engine.symbols.join(", ") : "None"}
                  </div>
                </div>
                <div>
                  <div className="muted text-xs">Device slots</div>
                  <div className="mt-2 mono text-xs font-medium">
                    {engine.usedSlots} of {maxDev || "—"}
                  </div>
                </div>
                <div>
                  <div className="muted text-xs">Last heartbeat</div>
                  <div className="mt-2 mono text-xs font-medium">
                    {timeAgo(engine.session?.last_heartbeat_at ?? engine.last_seen_at, nowMs)}
                  </div>
                </div>
              </div>

              {/* License badge row */}
              <div className="px-5 pb-4 flex flex-wrap items-center gap-2">
                <span className={`badge ${engine.license?.status === "active" ? "badge-green" : engine.license ? "badge-warn" : "badge-muted"}`}>
                  License: {engine.license?.status ?? "unknown"}
                </span>
                {licExp && (
                  <span className="badge badge-muted">
                    Expires {new Date(licExp).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </span>
                )}
                {state === "degraded" && <span className="badge badge-warn">Heartbeat delayed</span>}
              </div>

              {/* Disconnect reason */}
              {state === "offline" && engine.session?.disconnect_reason && (
                <div className="px-5 pb-4 text-xs muted border-t border-white/[.05] pt-3">
                  Last disconnect: {engine.session.disconnect_reason}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
