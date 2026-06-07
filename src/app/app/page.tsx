"use client";

import { createBrowserSupabase } from "@/lib/supabase";
import { useGateway } from "@/components/gateway-provider";
import { useAuth } from "@/components/auth-provider";
import { ArrowRight, KeyRound, Server, Terminal } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

/* ── types ────────────────────────────────────────────────────────────── */
type LicenseRow = {
  id: string;
  plan_name?: string;
  plan_id?: string;
  status: string;
  max_devices: number;
  expires_at: string | null;
  symbols?: string[];
};

type EngineRow = {
  id: string;
  engine_id: string;
  device_name: string;
  status: string;
  last_seen_at: string | null;
  session?: { last_heartbeat_at: string | null; disconnected_at: string | null } | null;
};

const ONLINE_THRESHOLD_MS = 90_000;
const DEGRADED_THRESHOLD_MS = 300_000;

function engineOnlineState(
  engine: EngineRow,
  nowMs: number
): "online" | "degraded" | "offline" {
  const hb = engine.session?.last_heartbeat_at ?? engine.last_seen_at;
  if (!hb || !nowMs) return "offline";
  if (engine.session?.disconnected_at) return "offline";
  if (engine.status !== "active") return "offline";
  const age = nowMs - Date.parse(hb);
  if (age <= ONLINE_THRESHOLD_MS) return "online";
  if (age <= DEGRADED_THRESHOLD_MS) return "degraded";
  return "offline";
}

/* ── tiny components ─────────────────────────────────────────────────── */
function StatusRow({
  label,
  value,
  dot,
}: {
  label: string;
  value: string;
  dot: "live" | "warn" | "dead" | "muted";
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/[.06] last:border-0">
      <span className="text-xs muted">{label}</span>
      <span className="flex items-center gap-2 text-xs font-medium">
        <span className={`dot dot-${dot}${dot === "live" ? " pulse" : ""}`} />
        {value}
      </span>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  tone = "normal",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "normal" | "good" | "warn" | "danger";
}) {
  const color =
    tone === "good"   ? "text-[#3ddc97]"
    : tone === "warn" ? "text-[#f5b942]"
    : tone === "danger" ? "text-[#f43f5e]"
    : "";
  return (
    <div className="panel p-4 min-h-28">
      <div className="text-[10px] uppercase tracking-[.13em] muted">{label}</div>
      <div className={`mt-4 text-2xl font-semibold tracking-tight ${color}`}>{value}</div>
      {sub && <div className="mt-2 text-xs muted">{sub}</div>}
    </div>
  );
}

function SectionRule({ label }: { label: string }) {
  return (
    <div className="section-rule">
      <span className="section-rule-bar" />
      <span className="section-rule-label">{label}</span>
      <span className="section-rule-line" />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="panel p-4 min-h-28">
      <div className="skeleton h-2.5 w-20 mb-5" />
      <div className="skeleton h-6 w-24 mb-2" />
      <div className="skeleton h-2 w-32" />
    </div>
  );
}

/* ── page ────────────────────────────────────────────────────────────── */
export default function Overview() {
  const { session } = useAuth();
  const gateway = useGateway();
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [engines, setEngines] = useState<EngineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(0);

  const load = useCallback(async () => {
    if (!supabase) {
      setDbError("Supabase is not configured.");
      setLoading(false);
      return;
    }

    const [licResult, devResult] = await Promise.all([
      supabase
        .from("licenses")
        .select("id,plan_name,plan_id,status,max_devices,expires_at"),
      supabase
        .from("engine_devices")
        .select("id,engine_id,device_name,status,last_seen_at")
        .order("activated_at", { ascending: false }),
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

    if (sessResult.error) {
      setDbError(sessResult.error.message);
      setLoading(false);
      return;
    }

    const sessionMap = new Map<string, { last_heartbeat_at: string | null; disconnected_at: string | null }>();
    for (const s of (sessResult.data ?? []) as { engine_device_id: string; last_heartbeat_at: string | null; disconnected_at: string | null }[]) {
      if (!sessionMap.has(s.engine_device_id)) sessionMap.set(s.engine_device_id, s);
    }

    setLicenses((licResult.data ?? []) as LicenseRow[]);
    setEngines(
      ((devResult.data ?? []) as EngineRow[]).map(d => ({
        ...d,
        session: sessionMap.get(d.id) ?? null,
      }))
    );
    setDbError(null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    const clock = setInterval(() => setNowMs(Date.now()), 10_000);
    setNowMs(Date.now());
    return () => { clearTimeout(t); clearInterval(clock); };
  }, [load]);

  const activeLicense = licenses.find(l => l.status === "active") ?? licenses[0];
  const planLabel = activeLicense
    ? String(
        (activeLicense as Record<string, unknown>).plan_name ??
        (activeLicense as Record<string, unknown>).plan_id ??
        "Active"
      )
    : null;

  const onlineCount  = engines.filter(e => engineOnlineState(e, nowMs) === "online").length;
  const degradedCount = engines.filter(e => engineOnlineState(e, nowMs) === "degraded").length;

  const gwReady     = gateway.status === "authenticated";
  const gwConnecting = gateway.status === "connecting";
  const gwDot: "live"|"warn"|"dead" = gwReady ? "live" : gwConnecting ? "warn" : "dead";
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
    <div className="p-5 md:p-8 max-w-7xl mx-auto page-in space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[.17em] muted">Dashboard</div>
          <h1 className="text-3xl font-semibold mt-2 tracking-tight">Overview</h1>
          <p className="muted mt-1 text-sm">System status and account snapshot.</p>
        </div>
        <span className="pill">
          <span className={`dot dot-${gwDot}${gwReady ? " pulse" : ""}`} />
          {gwReady ? "Gateway Online" : gwConnecting ? "Connecting…" : "Gateway Offline"}
        </span>
      </div>

      {/* DB error */}
      {dbError && (
        <div className="panel p-4 border-[#f43f5e]/30 bg-[#f43f5e]/05 text-sm text-[#f43f5e]">
          {dbError}
        </div>
      )}

      {/* Supabase not configured */}
      {!supabase && !loading && (
        <div className="panel p-4 border-[#f5b942]/30 bg-[#f5b942]/05">
          <div className="text-xs font-bold uppercase tracking-wider text-[#f5b942]">
            Supabase setup required
          </div>
          <p className="text-xs muted mt-2 leading-5">
            Add <code className="text-white">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="text-white">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to the
            environment and restart the server.
          </p>
        </div>
      )}

      {/* System status */}
      <section>
        <SectionRule label="System status" />
        <div className="panel p-4">
          <StatusRow
            label="Gateway"
            value={
              gwReady
                ? "Authenticated"
                : gwConnecting
                ? "Connecting…"
                : gateway.status === "rejected"
                ? "Rejected"
                : "Offline"
            }
            dot={gwDot}
          />
          <StatusRow
            label="Signal stream"
            value={sigLive ? "Live" : gwReady ? "Idle — not subscribed" : "Offline"}
            dot={sigLive ? "live" : gwReady ? "muted" : "dead"}
          />
          <StatusRow
            label="Execution stream"
            value={exLive ? "Live (private)" : gateway.executionMetricsError ?? "Not connected"}
            dot={exLive ? "live" : "muted"}
          />
          <StatusRow
            label="Session"
            value={session ? session.user.email ?? "Authenticated" : "Not signed in"}
            dot={session ? "live" : "dead"}
          />
        </div>
      </section>

      {/* Summary cards */}
      <section>
        <SectionRule label="Account snapshot" />
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <SummaryCard
                label="License"
                value={planLabel ?? "No license"}
                sub={
                  activeLicense
                    ? `${activeLicense.status} · ${activeLicense.max_devices} device${activeLicense.max_devices === 1 ? "" : "s"}`
                    : "Purchase a plan to begin"
                }
                tone={activeLicense ? "good" : "warn"}
              />
              <SummaryCard
                label="Engines"
                value={String(engines.length)}
                sub={
                  onlineCount > 0
                    ? `${onlineCount} online${degradedCount > 0 ? ` · ${degradedCount} degraded` : ""}`
                    : engines.length > 0
                    ? "All offline"
                    : "No engines activated"
                }
                tone={onlineCount > 0 ? "good" : engines.length > 0 ? "warn" : "normal"}
              />
              <SummaryCard
                label="Balance"
                value={exLive ? moneyFmt(numberMetric("balance")) : "--"}
                sub={exLive ? String(accountMetrics.currency ?? "Account currency") : "Connect execution stream"}
                tone="normal"
              />
              <SummaryCard
                label="Daily P&L"
                value={exLive ? moneyFmt(numberMetric("daily_pnl")) : "--"}
                sub={exLive ? "From private execution stream" : "Requires engine connection"}
                tone="normal"
              />
            </>
          )}
        </div>
      </section>

      {/* Signal Engine availability */}
      <section>
        <SectionRule label="Signal Engine" />
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              {[
                ["Scanner ticks",  (gateway.signalMetrics.metrics as Record<string,number>)?.scanner_ticks],
                ["Signals emitted", (gateway.signalMetrics.metrics as Record<string,number>)?.signals_emitted],
                ["Active signals",  (gateway.signalMetrics.metrics as Record<string,number>)?.active_signals],
                ["WS clients",     (gateway.signalMetrics.metrics as Record<string,number>)?.websocket_clients],
              ].map(([label, val]) => (
                <div key={String(label)} className="metric-tile">
                  <div className="text-[10px] uppercase tracking-[.12em] muted">{label}</div>
                  <div className="mt-2 text-lg font-semibold mono">
                    {val === undefined ? "--" : Number(val).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Engines list preview */}
      {!loading && engines.length > 0 && (
        <section>
          <SectionRule label="My engines" />
          <div className="space-y-3">
            {engines.slice(0, 3).map(engine => {
              const state = engineOnlineState(engine, nowMs);
              const dotClass = state === "online" ? "dot-live pulse" : state === "degraded" ? "dot-warn" : "dot-dead";
              const stateLabel = state === "online" ? "Online" : state === "degraded" ? "Degraded" : "Offline";
              return (
                <div key={engine.id} className="panel p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Terminal size={14} className="muted shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{engine.engine_id}</div>
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
              <Link href="/app/engines" className="muted text-xs hover:text-white flex items-center gap-1 px-1">
                View all {engines.length} engines <ArrowRight size={11} />
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Next setup step */}
      {nextStep && (
        <section>
          <SectionRule label="Next step" />
          <div className="panel p-5 border-[#3ddc97]/20 bg-[#3ddc97]/[.03]">
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-xl bg-[#3ddc97]/10 border border-[#3ddc97]/25 grid place-items-center shrink-0">
                {nextStep.href === "/app/billing" ? (
                  <Server size={15} className="text-[#3ddc97]" />
                ) : (
                  <KeyRound size={15} className="text-[#3ddc97]" />
                )}
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
