"use client";

import { getBrowserSupabase } from "@/lib/supabase-singleton";
import { useGateway } from "@/components/gateway-provider";
import { Page, SectionRule } from "@/components/ui/page";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { StatusBadge, type StatusKind } from "@/components/ui/status-badge";
import { SurfaceSection } from "@/components/ui/surface";
import { ActionCard, type SetupStep } from "@/components/ui/action-card";
import { EventFeed, type FeedEvent } from "@/components/ui/event-feed";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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

type SignalEventEntry = {
  id: string;
  event_type: string;
  ts: string;
  summary: string;
  data: Record<string, unknown>;
};

const ONLINE_THRESHOLD_MS = 90_000;
const DEGRADED_THRESHOLD_MS = 300_000;

function engineOnlineState(engine: EngineRow, nowMs: number): "online" | "degraded" | "offline" {
  const hb = engine.session?.last_heartbeat_at ?? engine.last_seen_at;
  if (!hb || !nowMs) return "offline";
  if (engine.session?.disconnected_at) return "offline";
  if (engine.status !== "active") return "offline";
  const age = nowMs - Date.parse(hb);
  if (age <= ONLINE_THRESHOLD_MS) return "online";
  if (age <= DEGRADED_THRESHOLD_MS) return "degraded";
  return "offline";
}

/* ── page ────────────────────────────────────────────────────────────── */
export default function Overview() {
  const gateway = useGateway();
  const { status: gwStatus } = gateway;
  const supabase = getBrowserSupabase();

  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [engines, setEngines] = useState<EngineRow[]>([]);
  const [selectedEngineId, setSelectedEngineId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(0);

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
    setSelectedEngineId(prev => prev ?? engineRows[0]?.engine_id ?? null);
    setDbError(null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const t = setTimeout(() => { void load(); setNowMs(Date.now()); }, 0);
    const clock = setInterval(() => setNowMs(Date.now()), 10_000);
    return () => { clearTimeout(t); clearInterval(clock); };
  }, [load]);

  // 3.14 - Live push: refresh overview data when licenses or devices change.
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("overview-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "licenses" }, () => {
        void load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "engine_devices" }, () => {
        void load();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, load]);

  /* ── derived readiness ─────────────────────────────────────────────── */
  const activeLicense = licenses.find(l => l.status === "active") ?? licenses[0];
  const licenseExpired = activeLicense
    ? activeLicense.status !== "active" ||
      (activeLicense.expires_at !== null && Date.parse(activeLicense.expires_at) < nowMs)
    : false;

  const onlineCount = engines.filter(e => engineOnlineState(e, nowMs) === "online").length;
  const degradedCount = engines.filter(e => engineOnlineState(e, nowMs) === "degraded").length;

  const gwReady = gwStatus === "authenticated";
  const sigLive = gwReady && Boolean(gateway.signalMetrics);
  const exLive = gwReady && Boolean(gateway.executionMetrics);
  const exForbidden = Boolean(gateway.executionMetricsError);

  const licenseState: { kind: StatusKind; label: string; detail: string } = !activeLicense
    ? { kind: "none", label: "Missing", detail: "Purchase a plan to begin" }
    : licenseExpired
      ? { kind: "expired", label: activeLicense.status === "active" ? "Expired" : activeLicense.status, detail: "Renew in Billing" }
      : { kind: "active", label: "Active", detail: `${activeLicense.max_devices} device${activeLicense.max_devices === 1 ? "" : "s"} max` };

  const agentState: { kind: StatusKind; label: string; detail: string } =
    engines.length === 0
      ? { kind: "none", label: "None", detail: "No AQ Agent activated" }
      : onlineCount > 0
        ? { kind: "online", label: "Online", detail: `${onlineCount} of ${engines.length} connected${degradedCount > 0 ? ` · ${degradedCount} degraded` : ""}` }
        : degradedCount > 0
          ? { kind: "degraded", label: "Degraded", detail: "Heartbeat is stale" }
          : { kind: "offline", label: "Offline", detail: "Agent is not connected" };

  const gatewayState: { kind: StatusKind; label: string; detail: string } =
    gwReady
      ? { kind: "online", label: "Online", detail: "Dashboard session authenticated" }
      : gwStatus === "connecting"
        ? { kind: "connecting", label: "Connecting", detail: "Reaching the gateway…" }
        : gwStatus === "rejected"
          ? { kind: "rejected", label: "Rejected", detail: gateway.error ?? "Session rejected" }
          : { kind: "offline", label: "Offline", detail: "Reconnecting automatically" };

  const executionState: { kind: StatusKind; label: string; detail: string } =
    exForbidden
      ? { kind: "forbidden", label: "Forbidden", detail: gateway.executionMetricsError ?? "Access denied" }
      : exLive
        ? { kind: "live", label: "Live", detail: "Private telemetry streaming" }
        : onlineCount > 0
          ? { kind: "waiting", label: "Waiting", detail: "Awaiting first snapshot" }
          : { kind: "offline", label: "Offline", detail: "Requires a connected agent" };

  /* ── setup flow ────────────────────────────────────────────────────── */
  const setupComplete = Boolean(activeLicense) && !licenseExpired && onlineCount > 0;
  const steps: SetupStep[] = [
    {
      label: "Purchase a plan",
      state: activeLicense && !licenseExpired ? "done" : "current",
      action: <Link href="/app/billing" className="btn btn-sm">Billing <ArrowRight size={11} /></Link>,
    },
    {
      label: "Download and install AQ Agent beside MetaTrader 5",
      state: engines.length > 0 ? "done" : activeLicense && !licenseExpired ? "current" : "upcoming",
      action: <Link href="/app/downloads" className="btn btn-sm">Downloads <ArrowRight size={11} /></Link>,
    },
    {
      label: "Activate the agent with your license key",
      state: engines.length > 0 ? "done" : "upcoming",
      action: <Link href="/app/licenses" className="btn btn-sm">Keys <ArrowRight size={11} /></Link>,
    },
    {
      label: "Wait for the engine stream to come online",
      state: onlineCount > 0 ? "done" : engines.length > 0 ? "current" : "upcoming",
      action: <Link href="/app/engines" className="btn btn-sm">Engines <ArrowRight size={11} /></Link>,
    },
  ];

  /* ── execution snapshot values ─────────────────────────────────────── */
  const metrics = (gateway.executionMetrics?.metrics ?? {}) as Record<string, unknown>;
  const num = (...keys: string[]): number | undefined => {
    for (const k of keys) {
      const v = metrics[k];
      if (typeof v === "number" && Number.isFinite(v)) return v;
    }
    return undefined;
  };
  const money = (v?: number) =>
    v === undefined ? "--" : `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const dailyPnl = num("daily_pnl");

  /* ── signal telemetry ──────────────────────────────────────────────── */
  const sigCounters = (gateway.signalMetrics?.metrics ?? {}) as Record<string, number>;
  const sigCount = (k: string): string =>
    typeof sigCounters[k] === "number" ? Number(sigCounters[k]).toLocaleString() : "--";
  const recentSignalEvents: FeedEvent[] = (
    ((gateway.signalMetrics as Record<string, unknown> | null)?.recent_events as SignalEventEntry[] | undefined) ?? []
  )
    .slice(-8)
    .reverse()
    .map((e) => ({
      id: e.id,
      type: e.event_type,
      time: e.ts,
      summary: e.summary,
      tone: e.event_type.includes("reject") ? "warning"
        : e.event_type.includes("emit") || e.event_type.includes("signal") ? "success"
        : "neutral",
      details: e.data,
    }));

  return (
    <Page
      eyebrow="Dashboard"
      title="Overview"
      description="System readiness, private execution snapshot, and global signal health."
    >
      {dbError && <Alert tone="danger" title="Database error">{dbError}</Alert>}
      {!supabase && !loading && (
        <Alert tone="warning" title="Supabase setup required">
          Add <code className="text-white">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="text-white">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to the
          environment and restart the server.
        </Alert>
      )}

      {/* ── System readiness ── */}
      <section>
        <SectionRule label="System readiness" />
        {loading ? (
          <MetricGrid cols={4}>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="kpi"><Skeleton height={12} width={70} /><Skeleton height={22} width={90} className="mt-3" /></div>
            ))}
          </MetricGrid>
        ) : (
          <MetricGrid cols={4}>
            <MetricCard label="License" value={<StatusBadge kind={licenseState.kind} label={licenseState.label} />} detail={licenseState.detail} />
            <MetricCard label="AQ Agent" value={<StatusBadge kind={agentState.kind} label={agentState.label} />} detail={agentState.detail} />
            <MetricCard label="Gateway" value={<StatusBadge kind={gatewayState.kind} label={gatewayState.label} />} detail={gatewayState.detail} />
            <MetricCard label="Execution" value={<StatusBadge kind={executionState.kind} label={executionState.label} />} detail={executionState.detail} />
          </MetricGrid>
        )}
      </section>

      {/* ── Next action OR private execution snapshot ── */}
      {!loading && !setupComplete && (
        <section>
          <SectionRule label="Next step" />
          <ActionCard
            title="Finish setting up your execution network"
            description="Your AQ Agent receives private signals and executes on your MT5 account once these steps are complete."
            steps={steps}
          />
        </section>
      )}

      {!loading && setupComplete && (
        <section>
          <SectionRule
            label="My execution - private"
            action={
              engines.length > 1 ? (
                <div className="relative">
                  <select
                    value={selectedEngineId ?? ""}
                    onChange={e => {
                      const id = e.target.value || null;
                      setSelectedEngineId(id);
                      gateway.setExecutionMetricsEngine(id);
                    }}
                    className="appearance-none pl-2.5 pr-7 py-1 text-[11px] cursor-pointer"
                    style={{
                      background: "var(--surface-3)",
                      border: "1px solid var(--line-strong)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-soft)",
                      outline: "none",
                    }}
                  >
                    {engines.map(e => (
                      <option key={e.id} value={e.engine_id} style={{ background: "var(--surface-2)" }}>
                        {e.device_name || e.engine_id}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 muted pointer-events-none" />
                </div>
              ) : (
                <span className="text-[11px] muted mono">
                  {engines[0]?.device_name || engines[0]?.engine_id}
                </span>
              )
            }
          />
          <MetricGrid cols={3}>
            <MetricCard label="Balance" value={exLive ? money(num("balance", "current_balance")) : "--"} detail={exLive ? undefined : "Waiting for stream"} />
            <MetricCard label="Equity" value={exLive ? money(num("equity")) : "--"} />
            <MetricCard
              label="Daily P&L"
              value={exLive ? money(dailyPnl) : "--"}
              tone={dailyPnl === undefined ? "neutral" : dailyPnl > 0 ? "success" : dailyPnl < 0 ? "danger" : "neutral"}
            />
            <MetricCard label="Daily Budget" value={exLive ? money(num("daily_budget")) : "--"} detail={exLive ? `Used ${money(num("daily_budget_used"))}` : undefined} />
            <MetricCard label="Risk Per Trade" value={exLive ? money(num("risk_per_trade")) : "--"} />
            <MetricCard
              label="Open Positions"
              value={exLive ? String(num("open_trades", "trades_open_count") ?? "--") : "--"}
              tone={(num("open_trades", "trades_open_count") ?? 0) > 0 ? "info" : "neutral"}
            />
          </MetricGrid>
          <div className="mt-3">
            <Link href="/app/execution" className="muted text-xs hover:text-white inline-flex items-center gap-1">
              Open execution cockpit <ArrowRight size={11} />
            </Link>
          </div>
        </section>
      )}

      {/* ── Signal health - global ── */}
      <section>
        <SectionRule label="Signal health - global" />
        <div className="grid lg:grid-cols-2 gap-4">
          <SurfaceSection
            title="Signal stream"
            subtitle="Sanitised telemetry from the signal engine. Shared by all customers."
            badge={<StatusBadge kind={sigLive ? "live" : gwReady ? "waiting" : "offline"} label={sigLive ? "Live" : gwReady ? "Waiting" : "Offline"} />}
            actions={
              <Link href="/app/signals" className="btn btn-sm btn-ghost">
                Details <ArrowRight size={11} />
              </Link>
            }
          >
            <MetricGrid cols={3}>
              <MetricCard label="Scanner ticks" value={sigCount("scanner_ticks")} size="sm" />
              <MetricCard label="Signals emitted" value={sigCount("signals_emitted")} size="sm" />
              <MetricCard label="Active signals" value={sigCount("active_signals")} size="sm" />
            </MetricGrid>
          </SurfaceSection>

          <SurfaceSection
            title="Recent signal events"
            subtitle="Latest events forwarded by the gateway."
            flush
          >
            <EventFeed
              events={recentSignalEvents}
              emptyMessage={sigLive ? "No recent events in this snapshot." : "Events appear once the signal stream is live."}
              maxHeight={252}
            />
          </SurfaceSection>
        </div>
      </section>
    </Page>
  );
}
