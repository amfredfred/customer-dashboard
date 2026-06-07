"use client";

import { createBrowserSupabase } from "@/lib/supabase";
import { useGateway } from "@/components/gateway-provider";
import { useAuth } from "@/components/auth-provider";
import { SectionHead, PageHeader } from "@/components/metric-detail";
import { StatCard } from "@/components/stat-card";
import { ArrowRight, ChevronDown, KeyRound, Server, Terminal } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

/* ── types ────────────────────────────────────────────────────────────── */
type LicenseRow = {
  id: string;
  status: string;
  max_devices: number;
  expires_at: string | null;
};

type EngineRow = {
  id: string;
  engine_id: string;
  device_name: string;
  status: string;
  last_seen_at: string | null;
  session?: { last_heartbeat_at: string | null; disconnected_at: string | null } | null;
};

const ONLINE_THRESHOLD_MS  = 90_000;
const DEGRADED_THRESHOLD_MS = 300_000;

function engineOnlineState(engine: EngineRow, nowMs: number): "online" | "degraded" | "offline" {
  const hb = engine.session?.last_heartbeat_at ?? engine.last_seen_at;
  if (!hb || !nowMs)              return "offline";
  if (engine.session?.disconnected_at) return "offline";
  if (engine.status !== "active") return "offline";
  const age = nowMs - Date.parse(hb);
  if (age <= ONLINE_THRESHOLD_MS)  return "online";
  if (age <= DEGRADED_THRESHOLD_MS) return "degraded";
  return "offline";
}

/* ── tiny components ─────────────────────────────────────────────────── */
function StatusRow({ label, value, dot }: { label: string; value: string; dot: "live" | "warn" | "dead" | "muted" }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/[.05] last:border-0">
      <span className="text-xs muted">{label}</span>
      <span className="flex items-center gap-2 text-xs font-medium">
        <span className={`dot dot-${dot}${dot === "live" ? " pulse" : ""}`} />
        {value}
      </span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="kpi">
      <div className="skeleton h-2 w-20 mb-4" />
      <div className="skeleton h-5 w-24 mb-2" />
      <div className="skeleton h-2 w-28" />
    </div>
  );
}

/* ── page ────────────────────────────────────────────────────────────── */
export default function Overview() {
  const { session } = useAuth();
  const gateway = useGateway();
  const {
    setSignalMetricsSubscribed,
    setExecutionMetricsEngine,
    status: gwStatus,
  } = gateway;
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [licenses, setLicenses]         = useState<LicenseRow[]>([]);
  const [engines, setEngines]           = useState<EngineRow[]>([]);
  const [selectedEngineId, setSelectedEngineId] = useState<string | null>(null);
  const [loading, setLoading]           = useState(true);
  const [dbError, setDbError]           = useState<string | null>(null);
  const [nowMs, setNowMs]               = useState(0);

  const load = useCallback(async () => {
    if (!supabase) { setDbError("Supabase is not configured."); setLoading(false); return; }

    const [licResult, devResult] = await Promise.all([
      supabase.from("licenses").select("id,status,max_devices,expires_at"),
      supabase.from("engine_devices").select("id,engine_id,device_name,status,last_seen_at").order("activated_at", { ascending: false }),
    ]);

    if (licResult.error || devResult.error) {
      setDbError((licResult.error ?? devResult.error)!.message);
      setLoading(false);
      return;
    }

    const deviceIds = ((devResult.data ?? []) as EngineRow[]).map(d => d.id);
    const sessResult = deviceIds.length
      ? await supabase
          .from("engine_sessions")
          .select("engine_device_id,last_heartbeat_at,disconnected_at")
          .in("engine_device_id", deviceIds)
          .order("connected_at", { ascending: false })
      : { data: [], error: null };

    if (sessResult.error) { setDbError(sessResult.error.message); setLoading(false); return; }

    const sessionMap = new Map<string, { last_heartbeat_at: string | null; disconnected_at: string | null }>();
    for (const s of (sessResult.data ?? []) as { engine_device_id: string; last_heartbeat_at: string | null; disconnected_at: string | null }[]) {
      if (!sessionMap.has(s.engine_device_id)) sessionMap.set(s.engine_device_id, s);
    }

    setLicenses((licResult.data ?? []) as LicenseRow[]);
    const engineRows = ((devResult.data ?? []) as EngineRow[]).map(d => ({ ...d, session: sessionMap.get(d.id) ?? null }));
    setEngines(engineRows);
    // Auto-select first engine (preserve existing selection on refresh)
    setSelectedEngineId(prev => prev ?? engineRows[0]?.engine_id ?? null);
    setDbError(null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const t     = setTimeout(() => void load(), 0);
    const clock = setInterval(() => setNowMs(Date.now()), 10_000);
    setNowMs(Date.now());
    return () => { clearTimeout(t); clearInterval(clock); };
  }, [load]);

  /* Subscribe to signal.metrics as soon as gateway is authenticated.
     Unsubscribes on unmount or when navigating away from overview. */
  useEffect(() => {
    if (gwStatus !== "authenticated") return;
    setSignalMetricsSubscribed(true);
    return () => setSignalMetricsSubscribed(false);
  }, [gwStatus, setSignalMetricsSubscribed]);

  /* Subscribe to execution.metrics for the selected engine.
     Re-fires when the user picks a different engine from the dropdown. */
  useEffect(() => {
    if (gwStatus === "authenticated" && selectedEngineId) {
      setExecutionMetricsEngine(selectedEngineId);
    } else {
      setExecutionMetricsEngine(null);
    }
    return () => setExecutionMetricsEngine(null);
  }, [gwStatus, selectedEngineId, setExecutionMetricsEngine]);

  const activeLicense = licenses.find(l => l.status === "active") ?? licenses[0];
  const planLabel = activeLicense ? "Active license" : null;

  const onlineCount   = engines.filter(e => engineOnlineState(e, nowMs) === "online").length;
  const degradedCount = engines.filter(e => engineOnlineState(e, nowMs) === "degraded").length;

  const gwReady      = gwStatus === "authenticated";
  const gwConnecting = gwStatus === "connecting";
  const gwDot: "live" | "warn" | "dead" = gwReady ? "live" : gwConnecting ? "warn" : "dead";
  const sigLive = gwReady && Boolean(gateway.signalMetrics);
  const exLive  = gwReady && Boolean(gateway.executionMetrics);

  const accountMetrics = gateway.executionMetrics?.metrics ?? {};
  const numberMetric = (k: string) =>
    typeof accountMetrics[k] === "number" ? (accountMetrics[k] as number) : undefined;
  const moneyFmt = (v?: number) =>
    v === undefined ? "--" : `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const nextStep = !activeLicense
    ? { title: "Purchase a plan", detail: "Visit Billing to choose a license and receive an activation key.", href: "/app/billing" }
    : engines.length === 0
    ? { title: "Install the Execution Engine", detail: "Download and install the engine on a Windows VPS beside MetaTrader 5, then activate it with a key from Licenses & Keys.", href: "/app/licenses" }
    : onlineCount === 0
    ? { title: "Connect your engine", detail: "Your engine is installed but not connected. Ensure it is running and has a valid activation key.", href: "/app/engines" }
    : null;

  return (
    <div className="page-wrap space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title="Overview"
        description="System status and account snapshot."
        right={
          <span className="pill">
            <span className={`dot dot-${gwDot}${gwReady ? " pulse" : ""}`} />
            {gwReady ? "Gateway Online" : gwConnecting ? "Connecting…" : "Gateway Offline"}
          </span>
        }
      />

      {/* DB error */}
      {dbError && (
        <div className="panel p-4" style={{ borderColor: "rgba(244,63,94,.3)", background: "rgba(244,63,94,.05)" }}>
          <p className="text-sm text-[#f43f5e]">{dbError}</p>
        </div>
      )}

      {/* Supabase not configured */}
      {!supabase && !loading && (
        <div className="panel p-4" style={{ borderColor: "rgba(245,185,66,.3)", background: "rgba(245,185,66,.05)" }}>
          <div className="text-xs font-bold uppercase tracking-wider text-[#f5b942] mb-2">
            Supabase setup required
          </div>
          <p className="text-xs muted leading-5">
            Add <code className="text-white">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="text-white">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to the
            environment and restart the server.
          </p>
        </div>
      )}

      {/* System status */}
      <section>
        <SectionHead label="System status" />
        <div className="panel p-4">
          <StatusRow label="Gateway" value={gwReady ? "Authenticated" : gwConnecting ? "Connecting…" : gwStatus === "rejected" ? "Rejected" : "Offline"} dot={gwDot} />
          <StatusRow label="Signal stream" value={sigLive ? "Live" : gwReady ? "Idle — not subscribed" : "Offline"} dot={sigLive ? "live" : gwReady ? "muted" : "dead"} />
          <StatusRow label="Execution stream" value={exLive ? "Live (private)" : gateway.executionMetricsError ?? "Not connected"} dot={exLive ? "live" : "muted"} />
          <StatusRow label="Session" value={session ? session.user.email ?? "Authenticated" : "Not signed in"} dot={session ? "live" : "dead"} />
        </div>
      </section>

      {/* Account snapshot */}
      <section>
        <SectionHead
          label="Account snapshot"
          action={
            !loading && engines.length > 1 ? (
              <div className="relative">
                <select
                  value={selectedEngineId ?? ""}
                  onChange={e => setSelectedEngineId(e.target.value || null)}
                  className="appearance-none pl-2.5 pr-7 py-1 text-[11px] cursor-pointer"
                  style={{
                    background: "var(--surface-raised)",
                    border: "1px solid var(--line-strong)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-soft)",
                    outline: "none",
                  }}
                >
                  {engines.map(e => (
                    <option key={e.id} value={e.engine_id} style={{ background: "#0d1015" }}>
                      {e.device_name || e.engine_id}
                    </option>
                  ))}
                </select>
                <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 muted pointer-events-none" />
              </div>
            ) : !loading && engines.length === 1 ? (
              <span className="text-[11px] muted mono">{engines[0].device_name || engines[0].engine_id}</span>
            ) : undefined
          }
        />
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <StatCard
                label="License"
                value={planLabel ?? "No license"}
                detail={activeLicense ? `${activeLicense.status} · ${activeLicense.max_devices} device${activeLicense.max_devices === 1 ? "" : "s"}` : "Purchase a plan to begin"}
                tone={activeLicense ? "good" : "warn"}
              />
              <StatCard
                label="Engines"
                value={String(engines.length)}
                detail={onlineCount > 0 ? `${onlineCount} online${degradedCount > 0 ? ` · ${degradedCount} degraded` : ""}` : engines.length > 0 ? "All offline" : "No engines activated"}
                tone={onlineCount > 0 ? "good" : engines.length > 0 ? "warn" : "normal"}
              />
              <StatCard
                label="Balance"
                value={exLive ? moneyFmt(numberMetric("balance")) : "--"}
                detail={exLive ? String(accountMetrics.currency ?? "Account currency") : "Connect execution stream"}
              />
              <StatCard
                label="Daily P&L"
                value={exLive ? moneyFmt(numberMetric("daily_pnl")) : "--"}
                detail={exLive ? "From private execution stream" : "Requires engine connection"}
              />
            </>
          )}
        </div>
      </section>

      {/* Signal Engine availability */}
      <section>
        <SectionHead label="Signal Engine" />
        <div className="panel p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="font-semibold text-sm">Signal Engine status</div>
              <p className="muted text-xs mt-1 leading-5">
                Global sanitised metrics. Available to all authenticated customers.
                Subscribe by opening the Signal Performance page.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {sigLive ? (
                <span className="badge badge-green">Live</span>
              ) : (
                <span className="badge badge-muted">Not subscribed</span>
              )}
              <Link href="/app/signals" className="pill text-xs hover:border-white/20 transition-colors inline-flex items-center gap-1">
                View <ArrowRight size={10} />
              </Link>
            </div>
          </div>
          {sigLive && gateway.signalMetrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5">
              {([
                ["Scanner ticks",   (gateway.signalMetrics.metrics as Record<string, number>)?.scanner_ticks],
                ["Signals emitted", (gateway.signalMetrics.metrics as Record<string, number>)?.signals_emitted],
                ["Active signals",  (gateway.signalMetrics.metrics as Record<string, number>)?.active_signals],
                ["WS clients",      (gateway.signalMetrics.metrics as Record<string, number>)?.websocket_clients],
              ] as [string, number | undefined][]).map(([label, val]) => (
                <div key={label} className="kpi">
                  <div className="kpi-label">{label}</div>
                  <div className="kpi-value">{val === undefined ? "--" : Number(val).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Engines list preview */}
      {!loading && engines.length > 0 && (
        <section>
          <SectionHead label="My engines" />
          <div className="space-y-2">
            {engines.slice(0, 3).map(engine => {
              const state = engineOnlineState(engine, nowMs);
              const dotClass = state === "online" ? "dot-live pulse" : state === "degraded" ? "dot-warn" : "dot-dead";
              const stateLabel = state === "online" ? "Online" : state === "degraded" ? "Degraded" : "Offline";
              return (
                <div key={engine.id} className="panel p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Terminal size={14} className="muted shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate mono">{engine.engine_id}</div>
                      <div className="text-xs muted truncate">{engine.device_name}</div>
                    </div>
                  </div>
                  <span className="pill shrink-0">
                    <span className={`dot ${dotClass}`} />
                    {stateLabel}
                  </span>
                </div>
              );
            })}
            {engines.length > 3 && (
              <Link href="/app/engines" className="muted text-xs hover:text-white flex items-center gap-1 px-1 pt-1">
                View all {engines.length} engines <ArrowRight size={11} />
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Next setup step */}
      {nextStep && (
        <section>
          <SectionHead label="Next step" />
          <div className="panel p-5" style={{ borderColor: "rgba(61,220,151,.2)", background: "rgba(61,220,151,.03)" }}>
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-xl bg-[#3ddc97]/10 border border-[#3ddc97]/25 grid place-items-center shrink-0">
                {nextStep.href === "/app/billing"
                  ? <Server size={15} className="text-[#3ddc97]" />
                  : <KeyRound size={15} className="text-[#3ddc97]" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{nextStep.title}</div>
                <p className="muted text-xs mt-1 leading-5">{nextStep.detail}</p>
              </div>
              <Link
                href={nextStep.href}
                className="pill shrink-0 hover:border-white/20 transition-colors inline-flex items-center gap-1 text-xs"
              >
                Go <ArrowRight size={10} />
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
