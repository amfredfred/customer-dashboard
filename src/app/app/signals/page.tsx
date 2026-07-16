"use client";

import { PageHeader, SectionHead } from "@/components/metric-detail";
import { useSignalEngine } from "@/components/signal-engine-provider";
import { useMemo, useState } from "react";
import { MetricCard } from "@/components/ui/metric-card";
import { Tabs } from "@/components/ui/tabs";
import { EventFeed, type FeedEvent, type FeedTone } from "@/components/ui/event-feed";
import { SurfaceSection } from "@/components/ui/surface";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { StaleBanner, LastUpdated } from "@/components/ui/stale-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { Clock, Settings2, ListX, Users, Radio, ShieldOff, Inbox, FileText, Search } from "lucide-react";

/* ── types ─────────────────────────────────────────────────────────────── */
type Tone   = "normal" | "good" | "warn" | "danger";
type TabId  =
  | "overview" | "configuration" | "metrics" | "performance"
  | "strategies" | "clients" | "signals" | "rejections" | "events" | "logs";

interface EventEntry {
  id:         string;
  event_type: string;
  ts:         string;
  summary:    string;
  data:       Record<string, unknown>;
}

interface SchedulerItem {
  symbol:       string;
  mode?:        string;
  tick_count?:  number;
  last_fired_at?: number;
  tick_stats?:  Record<string, { avg_ms?: number; p95_ms?: number; max_ms?: number; count?: number }>;
}

interface NSig {
  id: string; symbol: string; timeframe: string; strategy: string;
  direction: "BUY" | "SELL"; confidence?: number;
  entry: number; stopLoss: number; takeProfit: number;
  setup?: string; status: string; timestamp?: string;
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview",      label: "Overview"          },
  { id: "configuration", label: "Configuration"      },
  { id: "metrics",       label: "Runtime Metrics"    },
  { id: "performance",   label: "Performance"        },
  { id: "strategies",    label: "Active Strategies"  },
  { id: "clients",       label: "Connected Clients"  },
  { id: "signals",       label: "Recent Signals"     },
  { id: "rejections",    label: "Rejections"         },
  { id: "events",        label: "Recent Events"      },
  { id: "logs",          label: "Logs"               },
];

/* ── event classification ───────────────────────────────────────────────── */
function isRejectionEvent(t: string): boolean {
  return t.includes("reject") || t.includes("invalid") || t.includes("stale")
      || t.includes("blocked") || t.includes("filtered");
}
function isSignalEvent(t: string): boolean {
  return t.startsWith("signal.") && !isRejectionEvent(t);
}

/* ── helpers ────────────────────────────────────────────────────────────── */
function isN(v: unknown): v is number { return typeof v === "number" && !isNaN(v); }
function cnt(v: unknown): string  { return isN(v) ? v.toLocaleString("en-US") : "-"; }
function msf(v: unknown): string  { return isN(v) ? `${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}ms` : "-"; }
function pct(v: unknown): string  { return isN(v) ? `${v.toFixed(1)}%` : "-"; }

function pick(m: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) { if (isN(m[k])) return m[k] as number; }
  return undefined;
}

function sumPrefix(data: Record<string, number>, prefix: string): number {
  return Object.entries(data).filter(([k]) => k.startsWith(prefix)).reduce((s, [, v]) => s + v, 0);
}

function fmtTs(ts: unknown): string {
  if (!ts) return "-";
  try {
    const num = Number(ts);
    if (!isNaN(num) && String(ts).trim() !== "") {
      const d = new Date(num < 1e12 ? num * 1000 : num);
      if (!isNaN(d.getTime())) return d.toLocaleTimeString("en-US", { hour12: false });
    }
    const d = new Date(String(ts));
    if (!isNaN(d.getTime())) return d.toLocaleTimeString("en-US", { hour12: false });
    return String(ts).slice(0, 8);
  } catch { return String(ts).slice(0, 8); }
}

function shortTime(v?: number): string {
  if (!v) return "-";
  const d = new Date(v < 1e12 ? v * 1000 : v);
  return isNaN(d.getTime()) ? "-" : d.toLocaleTimeString("en-US", { hour12: false });
}

function fmtDuration(totalSeconds: unknown): string {
  if (!isN(totalSeconds) || totalSeconds < 0) return "-";
  const s = Math.round(totalSeconds);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function fmtPrice(n: number): string {
  if (n === 0) return "-";
  if (n > 1000) return n.toFixed(2);
  if (n > 10)   return n.toFixed(3);
  return n.toFixed(5);
}

function cfgValue(v: unknown): string {
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v))       return v.join(", ");
  if (v && typeof v === "object") return JSON.stringify(v);
  return String(v ?? "-");
}

/* ── tone helpers ───────────────────────────────────────────────────────── */
function lagTone(v: unknown): Tone {
  if (!isN(v)) return "normal";
  if (v > 60000) return "danger";
  if (v > 15000) return "warn";
  return "good";
}
function errTone(v: unknown): Tone { return isN(v) && v > 0 ? "warn" : "normal"; }
function valCls(t: Tone): string {
  return t === "good" ? " good" : t === "warn" ? " warn" : t === "danger" ? " danger" : "";
}

/* ── normalizer ─────────────────────────────────────────────────────────── */
function normalizeDir(v: unknown): "BUY" | "SELL" {
  const s = String(v ?? "").toUpperCase();
  return s === "SELL" || s === "SHORT" ? "SELL" : "BUY";
}

function normalizeSigEvent(ev: EventEntry): NSig {
  const d = ev.data;
  const htf = d.htf_interval ?? d.htfInterval;
  const ltf = d.ltf_interval ?? d.ltfInterval;
  const tf = [htf, ltf].filter(Boolean).join("/") || String(d.timeframe ?? d.tf ?? "CRT");
  const rawConf = d.confidence ?? d.strength;
  const conf = rawConf !== undefined
    ? (d.strength !== undefined ? Number(d.strength) / 100 : Number(rawConf))
    : undefined;
  return {
    id:         ev.id,   // use event ID - unique by seenRef dedup, stable across re-renders
    symbol:     String(d.symbol ?? "?"),
    timeframe:  tf,
    strategy:   String(d.pattern ?? d.strategy ?? "CRT"),
    direction:  normalizeDir(d.direction ?? d.side),
    confidence: conf !== undefined && !isNaN(conf) ? conf : undefined,
    entry:      Number(d.entry ?? d.entry_price ?? 0) || 0,
    stopLoss:   Number(d.sl ?? d.stopLoss ?? d.stop_loss ?? 0) || 0,
    takeProfit: Number(d.tp2 ?? d.tp ?? d.takeProfit ?? d.take_profit ?? 0) || 0,
    setup:      d.reason ? String(d.reason) : d.pattern ? String(d.pattern) : undefined,
    status:     String(ev.event_type.split(".").pop() ?? "EMITTED").toUpperCase(),
    timestamp:  ev.ts,
  };
}

/* ── primitives ─────────────────────────────────────────────────────────── */
const TR_BORDER: React.CSSProperties = { borderBottom: "1px solid rgba(255,255,255,0.04)" };

function TH({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-left text-[11px] font-semibold mono tracking-wide"
        style={{ color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
      {children}
    </th>
  );
}
function TD({ mono, children }: { mono?: boolean; children: React.ReactNode }) {
  return (
    <td className={`px-4 py-2.5 whitespace-nowrap text-xs${mono ? " font-mono tabular-nums" : ""}`}>
      {children}
    </td>
  );
}
const TONE_MAP = { normal: "neutral", good: "success", warn: "warning", danger: "danger" } as const;

/** Thin wrapper over the shared MetricCard, kept for the page's Tone type. */
function StatCard({ label, value, detail, tone = "normal" }: {
  label: string; value: string; detail?: string; tone?: Tone;
}) {
  return <MetricCard label={label} value={value} detail={detail} tone={TONE_MAP[tone]} />;
}
function MeterBar({ value, tone = "normal" }: { value?: number; tone?: Tone }) {
  const p = value === undefined || isNaN(value) ? undefined : Math.max(0, Math.min(100, value));
  const bg = tone === "good" ? "var(--success)" : tone === "warn" ? "var(--warning)" : tone === "danger" ? "var(--danger)" : "rgba(255,255,255,.22)";
  return (
    <div className="meter-track" style={{ marginTop: 8 }}>
      {p !== undefined && <div className="meter-fill" style={{ width: `${p}%`, background: bg }} />}
    </div>
  );
}
function GaugeCard({ label, value, display, context, tone = "normal" }: {
  label: string; value?: number; display: string; context?: string; tone?: Tone;
}) {
  return (
    <div className="panel p-4 flex flex-col justify-between" style={{ minHeight: 108 }}>
      <div className="text-[11px] font-semibold uppercase tracking-wide muted">{label}</div>
      <div>
        <div className={`text-2xl font-semibold tabular-nums${valCls(tone)}`}>{display}</div>
        <MeterBar value={value} tone={tone} />
        {context && <div className="text-xs muted mt-1.5">{context}</div>}
      </div>
    </div>
  );
}
function DirBadge({ dir }: { dir: "BUY" | "SELL" }) {
  const buy = dir === "BUY";
  return (
    <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded"
          style={{ background: buy ? "rgba(61,220,151,.12)" : "rgba(244,63,94,.12)",
                   color:      buy ? "#3ddc97" : "#f43f5e" }}>
      {dir}
    </span>
  );
}

/* ── Signal funnel ──────────────────────────────────────────────────────── */
type FunnelStep = { label: string; value?: number; tone?: Tone; indent?: boolean };

/** Funnel bars scaled by sqrt so low counts stay visible next to tick volume. */
function FunnelView({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(...steps.map(s => (isN(s.value) ? s.value : 0)), 1);
  return (
    <div className="surface p-4">
      {steps.map(s => {
        const v = isN(s.value) ? s.value : 0;
        const w = Math.max(Math.sqrt(v / max) * 100, v > 0 ? 2 : 0);
        const fill =
          s.tone === "good"   ? "rgba(61,220,151,.45)" :
          s.tone === "warn"   ? "rgba(245,185,66,.40)" :
          s.tone === "danger" ? "rgba(244,63,94,.40)"  :
          "rgba(255,255,255,.16)";
        return (
          <div key={s.label} className="funnel-step" style={s.indent ? { paddingLeft: 18 } : undefined}>
            <span className="funnel-label" style={s.indent ? { color: "var(--muted)" } : undefined}>
              {s.label}
            </span>
            <div className="funnel-bar-track">
              <div className="funnel-bar-fill" style={{ width: `${w}%`, background: fill }} />
            </div>
            <span className={`funnel-value${valCls(s.tone ?? "normal")}`}>{cnt(s.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Market status banner (always visible, above tabs) ─────────────────── */
interface MarketStatus {
  is_open: boolean;
  session: string;
  seconds_until_open: number | null;
  opens_at_ms: number | null;
  trading_enabled: boolean;
  trading_disabled_reason: string | null;
}

function MarketStatusBanner({ market }: { market: MarketStatus | null }) {
  if (!market) return null;
  const openBadge = market.is_open
    ? <StatusBadge kind="market_open" label="Market Open" />
    : <StatusBadge kind="weekend" label="Weekend / Closed" />;
  const tradingBadge = market.trading_enabled
    ? <StatusBadge kind="active" label="Trading Enabled" />
    : <StatusBadge kind="paused" label="Trading Disabled" />;

  return (
    <div className="panel p-4 flex flex-wrap items-center gap-x-8 gap-y-2">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wide muted mb-1">Market</div>
        {openBadge}
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wide muted mb-1">Trading</div>
        {tradingBadge}
      </div>
      {!market.trading_enabled && market.trading_disabled_reason && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide muted mb-1">Reason</div>
          <span className="text-xs muted capitalize">{market.trading_disabled_reason.replace(/_/g, " ")}</span>
        </div>
      )}
      {!market.is_open && market.seconds_until_open !== null && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide muted mb-1">Reopens In</div>
          <span className="text-xs mono font-semibold" style={{ color: "var(--warning)" }}>
            {fmtDuration(market.seconds_until_open)}
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Overview tab ───────────────────────────────────────────────────────── */
function OverviewTab({ metrics, scheduler, activeSignals, system, version, clientCount, connStatus, lastMetricsAt, isStale }: {
  metrics: Record<string, unknown>;
  scheduler: SchedulerItem[];
  activeSignals: Record<string, unknown>[];
  system: Record<string, unknown>;
  version: string;
  clientCount: number;
  connStatus: string;
  lastMetricsAt: number | null;
  isStale: boolean;
}) {
  const counters = (metrics.raw_counters ?? {}) as Record<string, number>;
  const gauges   = (metrics.raw_gauges   ?? {}) as Record<string, number>;
  const pairScans     = counters["scanner.pair_scans"] ?? 0;
  const trendBlocked  = sumPrefix(counters, "signals.trend_blocked.");
  const signalsEmitted = pick(metrics, "signals_emitted") ?? counters["signals.emitted"];

  return (
    <div className="space-y-5">
      {isStale && <StaleBanner label="Signal engine" lastUpdatedAt={lastMetricsAt} />}

      <section>
        <div className="flex items-center justify-between gap-3 mb-2">
          <SectionHead label="Engine Health" />
          <LastUpdated at={lastMetricsAt} />
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          <div className="kpi">
            <div className="kpi-label">Connection</div>
            <div className="mt-2"><StatusBadge kind={connStatus === "connected" ? "online" : connStatus === "connecting" ? "connecting" : "offline"} /></div>
          </div>
          <StatCard label="Uptime" value={fmtDuration(pick(system, "uptime_s"))} />
          <StatCard label="Memory" value={isN(system.memory_mb) ? `${(system.memory_mb as number).toFixed(0)} MB` : "-"} />
          <StatCard label="CPU" value={isN(system.cpu_percent) ? `${(system.cpu_percent as number).toFixed(1)}%` : "n/a"} />
        </div>
      </section>

      <section>
        <SectionHead label="System Information" />
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          <StatCard label="Version" value={version} />
          <StatCard label="Python" value={String(system.python ?? "-")} />
          <StatCard label="Platform" value={String(system.platform ?? "-")} />
          <StatCard label="Process ID" value={String(system.pid ?? "-")} />
        </div>
      </section>

      <section>
        <SectionHead label="Connected Clients" />
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          <StatCard label="Dashboard Clients" value={cnt(clientCount)} tone={clientCount > 0 ? "good" : "normal"} />
        </div>
      </section>

      <section>
        <SectionHead label="Scanner Health" />
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          <StatCard label="Scanner Ticks"     value={cnt(pick(metrics, "scanner_ticks"))}
            detail={`${cnt(pick(metrics, "scanner_tick_errors"))} tick errors`}
            tone={errTone(pick(metrics, "scanner_tick_errors"))} />
          <StatCard label="Pair Scans"        value={cnt(pairScans || pick(metrics, "analysis_started"))}
            detail={`${cnt(pick(metrics, "analysis_started"))} analysis cycles`} />
          <StatCard label="MT5 Calls"         value={cnt(pick(metrics, "mt5_calls"))}
            detail={`${cnt(pick(metrics, "mt5_errors"))} errors`}
            tone={errTone(pick(metrics, "mt5_errors"))} />
          <StatCard label="Active Symbols" value={cnt(pick(metrics, "scheduler_symbols") ?? gauges["scheduler.active_symbols"])}
            detail="symbols being scanned" />
        </div>
      </section>

      <section>
        <SectionHead label="Signal Funnel" />
        <FunnelView
          steps={[
            { label: "Scanner Ticks",    value: pick(metrics, "scanner_ticks") },
            { label: "Pair Scans",       value: pairScans || pick(metrics, "analysis_started") },
            { label: "Rejections Found", value: counters["signals.rejections_found"] },
            { label: "Signals Emitted",  value: isN(signalsEmitted) ? signalsEmitted : undefined, tone: "good" },
            { label: "Triggered",        value: pick(metrics, "signals_triggered"), tone: "good" },
            { label: "Trend Blocked",    value: trendBlocked, tone: "warn", indent: true },
            { label: "Quality Blocked",  value: counters["signals.quality_blocked"], tone: "warn", indent: true },
            { label: "Dedup Blocked",    value: pick(metrics, "signals_dedup_blocked"), tone: "warn", indent: true },
            { label: "Decision Blocked", value: pick(metrics, "signals_decision_blocked"), tone: "warn", indent: true },
            { label: "Stale Skipped",    value: pick(metrics, "signals_stale_skipped"), tone: "warn", indent: true },
          ]}
        />
      </section>

      <div className="grid xl:grid-cols-[1fr_260px] gap-5">
        <section className="min-w-0">
          <SectionHead label="Scheduler" />
          {scheduler.length === 0 ? (
            <div className="panel">
              <EmptyState
                icon={Clock}
                title="No scheduler rows"
                description="Symbol scan schedule will appear when the signal engine connects."
              />
            </div>
          ) : (
            <div className="panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-max text-xs">
                  <thead>
                    <tr>
                      {["Symbol", "Mode", "Ticks", "Last Fired", "Avg MS", "P95 MS"].map(c => <TH key={c}>{c}</TH>)}
                    </tr>
                  </thead>
                  <tbody>
                    {scheduler.map((item, i) => {
                      const stats = item.tick_stats ? Object.values(item.tick_stats)[0] ?? {} : {};
                      return (
                        <tr key={item.symbol ?? i} style={TR_BORDER}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.025)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "")}>
                          <TD mono><span className="font-bold text-white">{item.symbol ?? "-"}</span></TD>
                          <TD><span className="muted">{item.mode ?? "-"}</span></TD>
                          <TD mono>{cnt(item.tick_count)}</TD>
                          <TD mono><span className="muted">{shortTime(item.last_fired_at)}</span></TD>
                          <TD mono><span className="muted">{isN(stats.avg_ms) ? msf(stats.avg_ms) : "-"}</span></TD>
                          <TD mono><span className="muted">{isN(stats.p95_ms) ? msf(stats.p95_ms) : "-"}</span></TD>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section>
          <SectionHead label="Active State" />
          <div className="space-y-2.5">
            <StatCard label="Active Signals"      value={cnt(pick(metrics, "active_signals") ?? activeSignals.length)} />
            <StatCard label="Active Zones"        value={cnt(pick(metrics, "active_zones"))} />
            <StatCard label="Watchlist Open"      value={cnt(gauges["state.watchlist_open"])} />
            <StatCard label="Open Positions Gate" value={cnt(gauges["state.open_positions"])} />
          </div>
        </section>
      </div>

      {activeSignals.length > 0 && (
        <section className="min-w-0">
          <SectionHead label="Active Signals" />
          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-xs">
                <thead>
                  <tr>{["Time", "Symbol", "TF", "Strategy", "Side", "Entry", "SL", "TP"].map(c => <TH key={c}>{c}</TH>)}</tr>
                </thead>
                <tbody>
                  {activeSignals.map((sig, i) => {
                    const htf = sig.htf_interval ?? sig.htfInterval;
                    const ltf = sig.ltf_interval ?? sig.ltfInterval;
                    const tf  = [htf, ltf].filter(Boolean).join("/") || String(sig.timeframe ?? sig.tf ?? "-");
                    const dir = normalizeDir(sig.direction ?? sig.side ?? "BUY");
                    const entry = Number(sig.entry ?? 0);
                    const sl    = Number(sig.sl ?? sig.stopLoss ?? 0);
                    const tp    = Number(sig.tp2 ?? sig.tp ?? sig.takeProfit ?? 0);
                    return (
                      <tr key={i} style={TR_BORDER}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.025)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "")}>
                        <TD mono><span className="muted">{fmtTs(sig.entry_ts ?? sig.timestamp)}</span></TD>
                        <TD mono><span className="font-bold text-white">{String(sig.symbol ?? "?")}</span></TD>
                        <TD>
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded"
                                style={{ background: "rgba(255,255,255,.06)", color: "var(--text-soft)" }}>
                            {tf}
                          </span>
                        </TD>
                        <TD><span className="muted">{String(sig.pattern ?? sig.strategy ?? "CRT")}</span></TD>
                        <TD><DirBadge dir={dir} /></TD>
                        <TD mono><span className="muted">{entry > 0 ? fmtPrice(entry) : "-"}</span></TD>
                        <TD mono><span className="muted">{sl    > 0 ? fmtPrice(sl)    : "-"}</span></TD>
                        <TD mono><span className="muted">{tp    > 0 ? fmtPrice(tp)    : "-"}</span></TD>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

/* ── Metrics tab ────────────────────────────────────────────────────────── */
function MetricsTab({ metrics, api }: {
  metrics: Record<string, unknown>;
  api:     Record<string, unknown>;
}) {
  const counters = (metrics.raw_counters ?? {}) as Record<string, number>;
  const gauges   = (metrics.raw_gauges   ?? {}) as Record<string, number>;
  const emitted  = pick(metrics, "signals_emitted") ?? counters["signals.emitted"];
  const rejectionsFound = counters["signals.rejections_found"];
  const emitRate = isN(emitted) && isN(rejectionsFound) && rejectionsFound > 0
    ? (emitted / rejectionsFound) * 100 : undefined;
  const mt5Err  = pick(metrics, "mt5_errors");
  const mt5Calls = pick(metrics, "mt5_calls");
  const mt5ErrRate = isN(mt5Err) && isN(mt5Calls) && mt5Calls > 0
    ? (mt5Err / mt5Calls) * 100 : undefined;
  const scanLag  = pick(metrics, "last_scan_lag_ms") ?? gauges["latency.last_scan_lag_ms"];
  const emitLag  = pick(metrics, "last_emit_lag_ms") || undefined;
  const trendBlocked = sumPrefix(counters, "signals.trend_blocked.");

  const signalCounters = Object.fromEntries(Object.entries(counters).filter(([k]) => k.startsWith("signals.") || k.startsWith("events.")));
  const scannerGauges  = Object.fromEntries(Object.entries(gauges).filter(([k]) => k.startsWith("scanner.") || k.startsWith("latency.") || k.startsWith("state.")));
  const bySource = (api.by_source ?? {}) as Record<string, { total_calls?: number; errors?: number; avg_ms?: number }>;

  return (
    <div className="space-y-5">
      {/* Gauge cards */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <GaugeCard label="Emit Rate"      value={isN(emitRate) ? emitRate : undefined} display={pct(emitRate)}
          context="emitted / rejections found" tone={isN(emitRate) && emitRate > 0 ? "good" : "normal"} />
        <GaugeCard label="MT5 Error Rate" value={isN(mt5ErrRate) ? mt5ErrRate : undefined} display={pct(mt5ErrRate)}
          context={`${cnt(mt5Err)} errors`} tone={isN(mt5ErrRate) && mt5ErrRate > 0 ? "warn" : "normal"} />
        <GaugeCard label="Scan Lag"
          value={isN(scanLag) ? Math.min((scanLag / 60000) * 100, 100) : undefined}
          display={msf(scanLag)} context="latest scheduler lag" tone={lagTone(scanLag)} />
        <GaugeCard label="Emit Lag"
          value={isN(emitLag) ? Math.min((emitLag / 60000) * 100, 100) : undefined}
          display={msf(emitLag)} context="last emitted signal" tone={lagTone(emitLag)} />
      </div>

      <div className="grid xl:grid-cols-2 gap-5">
        <section>
          <SectionHead label="Scanner Counters" />
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            <StatCard label="Ticks"             value={cnt(pick(metrics, "scanner_ticks"))} />
            <StatCard label="Tick Errors"       value={cnt(pick(metrics, "scanner_tick_errors"))} tone={errTone(pick(metrics, "scanner_tick_errors"))} />
            <StatCard label="Analysis Started"  value={cnt(pick(metrics, "analysis_started"))} />
            <StatCard label="Pair Scans"        value={cnt(counters["scanner.pair_scans"])} />
            <StatCard label="Drift Detected"    value={cnt(counters["scanner.analysis_drift_detected"])} tone={errTone(counters["scanner.analysis_drift_detected"])} />
            <StatCard label="Insufficient HTF"  value={cnt(counters["scanner.insufficient_htf_data"])} />
          </div>
        </section>

        <section>
          <SectionHead label="Signal Funnel" />
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            <StatCard label="Rejections Found"  value={cnt(rejectionsFound)} />
            <StatCard label="Emitted"           value={cnt(emitted)} tone={isN(emitted) && emitted > 0 ? "good" : "normal"} />
            <StatCard label="Triggered"         value={cnt(pick(metrics, "signals_triggered"))} />
            <StatCard label="No LTF Range"      value={cnt(pick(metrics, "signals_no_ltf_range"))} />
            <StatCard label="No Rejection"      value={cnt(pick(metrics, "signals_no_rejection"))} />
            <StatCard label="Trend Blocked"     value={cnt(trendBlocked)} />
            <StatCard label="Stale Skipped"     value={cnt(pick(metrics, "signals_stale_skipped"))} tone={errTone(pick(metrics, "signals_stale_skipped"))} />
            <StatCard label="Dedup Blocked"     value={cnt(pick(metrics, "signals_dedup_blocked"))} />
            <StatCard label="Decision Blocked"  value={cnt(pick(metrics, "signals_decision_blocked"))} />
            <StatCard label="Quality Blocked"   value={cnt(counters["signals.quality_blocked"])} />
            <StatCard label="Watchlist Dup"     value={cnt(counters["signals.watchlist_duplicate"])} />
          </div>
        </section>
      </div>

      <div className="grid xl:grid-cols-2 gap-5">
        <section>
          <SectionHead label="Runtime Gauges" />
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            <StatCard label="Analysis MS"    value={msf(pick(metrics, "last_analysis_ms") ?? gauges["scanner.analysis_ms"])} />
            <StatCard label="Broadcast MS"   value={msf(gauges["latency.signal_broadcast_total_ms"])} />
            <StatCard label="Active Signals" value={cnt(pick(metrics, "active_signals"))} />
            <StatCard label="Active Zones"   value={cnt(pick(metrics, "active_zones"))} />
            <StatCard label="Watchlist Open" value={cnt(gauges["state.watchlist_open"])} />
            <StatCard label="Pending Zones"  value={cnt(gauges["state.pending_zones"])} />
          </div>
        </section>

        <section>
          <SectionHead label="Market Data API" />
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            <StatCard label="MT5 Calls"      value={cnt(mt5Calls)} />
            <StatCard label="MT5 Errors"     value={cnt(mt5Err)} tone={errTone(mt5Err)} />
            <StatCard label="Calls Last Min" value={cnt(isN(api.calls_last_min) ? api.calls_last_min : undefined)} />
            {Object.entries(bySource).slice(0, 6).map(([src, s]) => (
              <StatCard key={src} label={src} value={cnt(s.total_calls)}
                detail={`${msf(s.avg_ms)} avg · ${cnt(s.errors)} err`}
                tone={errTone(s.errors)} />
            ))}
          </div>
        </section>
      </div>

      {/* Collapsible raw tables */}
      {(Object.keys(signalCounters).length > 0 || Object.keys(scannerGauges).length > 0) && (
        <div className="grid xl:grid-cols-2 gap-4">
          {Object.keys(signalCounters).length > 0 && (
            <details className="panel overflow-hidden min-w-0">
              <summary className="panel-head cursor-pointer list-none">
                <div className="text-sm font-semibold">Signal Counters</div>
                <span className="badge badge-muted">{Object.keys(signalCounters).length}</span>
              </summary>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr><TH>Metric</TH><TH>Value</TH></tr></thead>
                  <tbody>{Object.entries(signalCounters).map(([k, v]) => (
                    <tr key={k} style={TR_BORDER}>
                      <TD mono><span className="muted">{k}</span></TD><TD mono>{v.toLocaleString()}</TD>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </details>
          )}
          {Object.keys(scannerGauges).length > 0 && (
            <details className="panel overflow-hidden min-w-0">
              <summary className="panel-head cursor-pointer list-none">
                <div className="text-sm font-semibold">Scanner Gauges</div>
                <span className="badge badge-muted">{Object.keys(scannerGauges).length}</span>
              </summary>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr><TH>Gauge</TH><TH>Value</TH></tr></thead>
                  <tbody>{Object.entries(scannerGauges).map(([k, v]) => (
                    <tr key={k} style={TR_BORDER}>
                      <TD mono><span className="muted">{k}</span></TD><TD mono>{v.toFixed(3)}</TD>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      )}
      {(Object.keys(counters).length > 0 || Object.keys(gauges).length > 0) && (
        <div className="grid xl:grid-cols-2 gap-4">
          {Object.keys(counters).length > 0 && (
            <details className="panel overflow-hidden min-w-0">
              <summary className="panel-head cursor-pointer list-none">
                <div className="text-sm font-semibold">Raw Counters</div>
                <span className="badge badge-muted">{Object.keys(counters).length}</span>
              </summary>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr><TH>Metric</TH><TH>Value</TH></tr></thead>
                  <tbody>{Object.entries(counters).map(([k, v]) => (
                    <tr key={k} style={TR_BORDER}>
                      <TD mono><span className="muted">{k}</span></TD><TD mono>{v.toLocaleString()}</TD>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </details>
          )}
          {Object.keys(gauges).length > 0 && (
            <details className="panel overflow-hidden min-w-0">
              <summary className="panel-head cursor-pointer list-none">
                <div className="text-sm font-semibold">Raw Gauges</div>
                <span className="badge badge-muted">{Object.keys(gauges).length}</span>
              </summary>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr><TH>Gauge</TH><TH>Value</TH></tr></thead>
                  <tbody>{Object.entries(gauges).map(([k, v]) => (
                    <tr key={k} style={TR_BORDER}>
                      <TD mono><span className="muted">{k}</span></TD>
                      <TD mono>{typeof v === "number" ? v.toFixed(4) : String(v)}</TD>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Performance tab ────────────────────────────────────────────────────── */
function PerformanceTab({ metrics, api, system }: {
  metrics: Record<string, unknown>;
  api:     Record<string, unknown>;
  system:  Record<string, unknown>;
}) {
  const gauges = (metrics.raw_gauges ?? {}) as Record<string, number>;
  const bySource = (api.by_source ?? {}) as Record<string, { total_calls?: number; errors?: number; avg_ms?: number }>;
  const avgApiMs = Object.values(bySource).length
    ? Object.values(bySource).reduce((s, v) => s + (v.avg_ms ?? 0), 0) / Object.values(bySource).length
    : undefined;

  return (
    <div className="space-y-5">
      <section>
        <SectionHead label="Signal Latency" />
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          <StatCard label="Scan Lag"
            value={msf(pick(metrics, "last_scan_lag_ms") ?? gauges["latency.last_scan_lag_ms"])}
            tone={lagTone(pick(metrics, "last_scan_lag_ms"))} />
          <StatCard label="Emit Lag"
            value={msf(pick(metrics, "last_emit_lag_ms") || undefined)}
            tone={lagTone(pick(metrics, "last_emit_lag_ms") || undefined)} />
          <StatCard label="Analysis Duration"
            value={msf(pick(metrics, "last_analysis_ms") ?? gauges["scanner.analysis_ms"])} />
          <StatCard label="Broadcast"
            value={msf(gauges["latency.signal_broadcast_total_ms"])} />
        </div>
      </section>

      <section>
        <SectionHead label="API Response Time" />
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          <StatCard label="Avg Response" value={msf(avgApiMs)} tone={lagTone(avgApiMs)} />
          <StatCard label="Calls / Min" value={cnt(isN(api.calls_last_min) ? api.calls_last_min : undefined)} />
          {Object.entries(bySource).slice(0, 6).map(([src, s]) => (
            <StatCard key={src} label={src} value={msf(s.avg_ms)}
              detail={`${cnt(s.total_calls)} calls · ${cnt(s.errors)} err`}
              tone={errTone(s.errors)} />
          ))}
        </div>
      </section>

      <section>
        <SectionHead label="Resource Usage" />
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          <StatCard label="Memory" value={isN(system.memory_mb) ? `${(system.memory_mb as number).toFixed(0)} MB` : "-"} />
          <StatCard label="CPU" value={isN(system.cpu_percent) ? `${(system.cpu_percent as number).toFixed(1)}%` : "n/a"} />
          <StatCard label="Uptime" value={fmtDuration(pick(system, "uptime_s"))} />
        </div>
      </section>
    </div>
  );
}

/* ── Active Strategies tab ──────────────────────────────────────────────── */
interface StrategyRow {
  symbol: string;
  tfPair: string;
  minRr: number;
  maxRr: number;
}

function ActiveStrategiesTab({ config }: { config: Record<string, unknown> | null | undefined }) {
  if (!config) {
    return (
      <div className="surface">
        <EmptyState
          icon={Settings2}
          title="Strategy config not available"
          description="The signal engine has not reported its configuration in this snapshot."
        />
      </div>
    );
  }

  const symbols = Array.isArray(config.symbols) ? (config.symbols as string[]) : [];
  const tfPairs = Array.isArray(config.tf_pairs) ? (config.tf_pairs as string[]) : [];

  const rows: StrategyRow[] = symbols.length
    ? symbols.map(symbol => ({
        symbol,
        tfPair: tfPairs[0] ?? "-",
        minRr: Number(config.min_rr ?? 0),
        maxRr: Number(config.max_rr ?? 0),
      }))
    : [];

  return (
    <div className="space-y-5">
      <section>
        <SectionHead label="Per-Symbol Strategy" />
        {rows.length === 0 ? (
          <div className="panel">
            <EmptyState icon={ListX} title="No symbols configured" />
          </div>
        ) : (
          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-xs">
                <thead>
                  <tr>{["Symbol", "Timeframe Pair", "Min RR", "Max RR"].map(c => <TH key={c}>{c}</TH>)}</tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.symbol} style={TR_BORDER}>
                      <TD mono><span className="font-bold text-white">{r.symbol}</span></TD>
                      <TD mono><span className="muted">{r.tfPair}</span></TD>
                      <TD mono>{r.minRr}</TD>
                      <TD mono>{r.maxRr}</TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section>
        <SectionHead label="Feature Flags" />
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          {[
            ["Trend Filter", config.use_trend_filter],
            ["Invalidation", config.use_invalidation],
            ["Displacement Filter", config.use_displacement_filter],
            ["Session Filter", config.use_session_filter],
            ["Multi-TF Independent Positions", config.multi_tf_independent_positions],
            ["Move SL to BE on TP1", config.move_sl_to_be_on_tp1],
          ].map(([label, value]) => (
            <div key={label as string} className="kpi">
              <div className="kpi-label">{label as string}</div>
              <div className="mt-2">
                <StatusBadge kind={value ? "active" : "idle"} label={value ? "Enabled" : "Disabled"} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ── Connected Clients tab ──────────────────────────────────────────────── */
interface ClientRow {
  client_id: string;
  symbols: string[];
  connected_at: number;
  uptime_s: number;
}

function ConnectedClientsTab({ clients }: { clients: ClientRow[] }) {
  if (clients.length === 0) {
    return (
      <div className="surface">
        <EmptyState
          icon={Users}
          title="No clients connected"
          description="Dashboard and downstream WebSocket clients will appear here once connected."
        />
      </div>
    );
  }
  return (
    <SurfaceSection
      icon={Users}
      title="Connected Clients"
      subtitle={`${clients.length} client${clients.length !== 1 ? "s" : ""} connected`}
      badge={<span className="badge badge-green">{clients.length}</span>}
      flush
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-xs">
          <thead>
            <tr>{["Client ID", "Subscribed Symbols", "Connected Since", "Uptime"].map(c => <TH key={c}>{c}</TH>)}</tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.client_id} style={TR_BORDER}>
                <TD mono><span className="font-bold text-white">{c.client_id}</span></TD>
                <TD><span className="muted">{c.symbols.join(", ") || "-"}</span></TD>
                <TD mono><span className="muted">{shortTime(c.connected_at)}</span></TD>
                <TD mono>{fmtDuration(c.uptime_s)}</TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SurfaceSection>
  );
}

/* ── Signals tab ────────────────────────────────────────────────────────── */
const SIGNAL_EVENT_COLUMNS: ColumnDef<NSig>[] = [
  { key: "time",     label: "Time",     render: s => <span className="muted mono">{fmtTs(s.timestamp)}</span> },
  { key: "symbol",   label: "Symbol",   render: s => <span className="font-bold text-white mono">{s.symbol}</span> },
  { key: "tf",       label: "TF",       render: s => (
    <span className="font-mono text-[11px] px-1.5 py-0.5 rounded"
          style={{ background: "rgba(255,255,255,.06)", color: "var(--text-soft)" }}>
      {s.timeframe}
    </span>
  ) },
  { key: "strategy", label: "Strategy", render: s => <span className="muted">{s.strategy}</span> },
  { key: "side",     label: "Side",     render: s => <DirBadge dir={s.direction} /> },
  { key: "conf",     label: "Conf",     render: s => <span className="mono">{s.confidence !== undefined ? `${(s.confidence * 100).toFixed(0)}%` : "-"}</span> },
  { key: "entry",    label: "Entry",    render: s => <span className="mono">{s.entry > 0 ? fmtPrice(s.entry) : "-"}</span> },
  { key: "sl",       label: "SL",       render: s => <span className="muted mono">{s.stopLoss > 0 ? fmtPrice(s.stopLoss) : "-"}</span> },
  { key: "tp",       label: "TP",       render: s => <span className="muted mono">{s.takeProfit > 0 ? fmtPrice(s.takeProfit) : "-"}</span> },
  { key: "setup",    label: "Setup",    render: s => <span className="muted block max-w-[200px] truncate">{s.setup ?? "-"}</span> },
  { key: "status",   label: "Status",   render: s => (
    <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded"
          style={{ background: "rgba(61,220,151,.12)", color: "var(--success)" }}>
      {s.status}
    </span>
  ) },
];

function SignalsTab({ signals }: { signals: NSig[] }) {
  if (!signals.length) {
    return (
      <div className="surface">
        <EmptyState
          icon={Radio}
          title="No signal events yet"
          description="Signal emission events accumulate here in real time as they arrive from the signal engine."
        />
      </div>
    );
  }
  return (
    <SurfaceSection
      icon={Radio}
      title="Signal Events"
      subtitle={`${signals.length} signal${signals.length !== 1 ? "s" : ""} accumulated`}
      badge={<span className="badge badge-green">{signals.length}</span>}
      flush
    >
      <DataTable
        columns={SIGNAL_EVENT_COLUMNS}
        rows={signals}
        rowKey={(s, i) => s.id ?? String(i)}
        emptyMessage="No signal events yet."
        renderCard={s => (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold mono text-sm" style={{ color: "var(--text)" }}>{s.symbol}</span>
              <span className="flex items-center gap-1.5 shrink-0">
                <DirBadge dir={s.direction} />
                <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(61,220,151,.12)", color: "var(--success)" }}>
                  {s.status}
                </span>
              </span>
            </div>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>
              {s.strategy} · {s.timeframe}
              {s.confidence !== undefined && <> · {(s.confidence * 100).toFixed(0)}%</>}
              <span className="ml-2 font-mono">{fmtTs(s.timestamp)}</span>
            </div>
            <div className="text-[11.5px] font-mono flex items-center gap-2 flex-wrap">
              <span style={{ color: "var(--text-soft)" }}>{s.entry > 0 ? fmtPrice(s.entry) : "-"}</span>
              <span style={{ color: "var(--muted)" }}>SL {s.stopLoss > 0 ? fmtPrice(s.stopLoss) : "-"}</span>
              <span style={{ color: "var(--muted)" }}>TP {s.takeProfit > 0 ? fmtPrice(s.takeProfit) : "-"}</span>
            </div>
          </div>
        )}
      />
    </SurfaceSection>
  );
}

/* ── Event tabs (shared EventFeed) ──────────────────────────────────────── */
function sigEventTone(type: string): FeedTone {
  if (type.includes("emitted") || type.includes("triggered") || type === "connected" || type === "subscribed") return "success";
  if (type.includes("reject") || type.includes("invalid")) return "danger";
  if (isRejectionEvent(type)) return "warning";
  return "neutral";
}

function toFeedEvents(items: EventEntry[]): FeedEvent[] {
  return items.map(ev => ({
    id: ev.id,
    type: ev.event_type,
    time: fmtTs(ev.ts),
    summary: ev.summary || String(ev.data.reason ?? ev.data.message ?? "-"),
    tone: sigEventTone(ev.event_type),
    details: ev.data,
  }));
}

function RejectionsTab({ items }: { items: EventEntry[] }) {
  if (!items.length) {
    return (
      <div className="surface">
        <EmptyState
          icon={ShieldOff}
          title="No rejections yet"
          description="Signal filter and rejection events will appear here as they arrive from the signal engine."
        />
      </div>
    );
  }
  return (
    <SurfaceSection
      icon={ShieldOff}
      title="Signal Rejections"
      subtitle={`${items.length} rejection${items.length !== 1 ? "s" : ""} accumulated - click a row for details`}
      badge={<span className="badge badge-red">{items.length}</span>}
      flush
    >
      <EventFeed events={toFeedEvents(items)} maxHeight={560} />
    </SurfaceSection>
  );
}

function EventsTab({ items }: { items: EventEntry[] }) {
  if (!items.length) {
    return (
      <div className="surface">
        <EmptyState
          icon={Inbox}
          title="No events yet"
          description="All signal engine events will appear here in real time."
        />
      </div>
    );
  }
  return (
    <SurfaceSection
      icon={Inbox}
      title="Recent Events"
      subtitle={`${items.length} event${items.length !== 1 ? "s" : ""} (max 500)`}
      badge={<span className="badge badge-muted">{items.length}</span>}
      flush
    >
      <EventFeed events={toFeedEvents(items)} maxHeight={560} />
    </SurfaceSection>
  );
}

/* ── Logs tab (system error records from errors.recent) ─────────────────── */
interface ErrorRecord {
  module: string;
  level: string;
  message: string;
  at: number;
}

function LogsTab({ records }: { records: ErrorRecord[] }) {
  const [query, setQuery] = useState("");

  if (!records.length) {
    return (
      <div className="surface">
        <EmptyState
          icon={FileText}
          title="No system log entries"
          description="Errors and warnings logged by the signal engine today will appear here."
        />
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? records.filter(r => r.message.toLowerCase().includes(q) || r.module.toLowerCase().includes(q) || r.level.toLowerCase().includes(q))
    : records;

  return (
    <SurfaceSection
      icon={FileText}
      title="System Log"
      subtitle={`${records.length} record${records.length !== 1 ? "s" : ""} today (most recent 10)`}
      badge={<span className="badge badge-muted">{records.length}</span>}
      flush
    >
      <div className="px-4 py-2.5" style={{ borderBottom: "1px solid var(--line-soft)" }}>
        <label className="search-input">
          <Search size={13} strokeWidth={2} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filter by module, level, or message…"
          />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-xs">
          <thead>
            <tr>{["Time", "Level", "Module", "Message"].map(c => <TH key={c}>{c}</TH>)}</tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-xs muted text-center">No log entries match &quot;{query}&quot;.</td></tr>
            )}
            {filtered.map((r, i) => (
              <tr key={i} style={TR_BORDER}>
                <TD mono><span className="muted">{fmtTs(r.at)}</span></TD>
                <TD>
                  <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded"
                        style={{
                          background: r.level === "ERROR" ? "rgba(244,63,94,.12)" : "rgba(245,185,66,.12)",
                          color: r.level === "ERROR" ? "#f43f5e" : "#f5b942",
                        }}>
                    {r.level}
                  </span>
                </TD>
                <TD><span className="muted">{r.module}</span></TD>
                <TD><span className="block max-w-[420px] truncate">{r.message}</span></TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SurfaceSection>
  );
}

/* ── Config tab ─────────────────────────────────────────────────────────── */
function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5"
         style={{ borderBottom: "1px solid rgba(255,255,255,.05)" }}>
      <span className="text-xs muted shrink-0">{label}</span>
      <span className="font-mono text-xs text-right min-w-0 break-all" style={{ color: "var(--text-soft)" }}>{value}</span>
    </div>
  );
}

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function weekdayTime(day: unknown, time: unknown): string {
  const name = WEEKDAY_NAMES[Number(day)] ?? String(day);
  return `${name} ${String(time ?? "-").slice(0, 8)}`;
}

function ConfigTab({ config, version }: {
  config: Record<string, unknown> | null | undefined;
  version: string;
}) {
  if (!config) {
    return (
      <div className="surface">
        <EmptyState
          icon={Settings2}
          title="Config not available"
          description="The signal engine has not reported its configuration in this snapshot."
        />
      </div>
    );
  }

  const ws = (config.websocket ?? {}) as Record<string, unknown>;
  const weekend = (config.weekend ?? {}) as Record<string, unknown>;
  const trading = (config.trading ?? {}) as Record<string, unknown>;
  const tfMaxRr = (config.tf_max_rr ?? {}) as Record<string, unknown>;
  const tfOverrides = (config.trade_management_tf_overrides ?? {}) as Record<string, unknown>;
  const tfDisplacementMult = (config.tf_displacement_mult ?? {}) as Record<string, unknown>;

  return (
    <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
      <div className="panel overflow-hidden">
        <div className="panel-head"><div className="text-sm font-semibold">Enabled Symbols &amp; Timeframes</div></div>
        <div className="panel-body">
          <ConfigRow label="Environment" value={String(trading.env ?? config.mode ?? "-").toUpperCase()} />
          {Array.isArray(config.symbols) && (
            <ConfigRow label="Symbols" value={(config.symbols as string[]).join(", ")} />
          )}
          {Array.isArray(config.tf_pairs) && (
            <ConfigRow label="Timeframe Pairs" value={(config.tf_pairs as string[]).join(", ")} />
          )}
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-head"><div className="text-sm font-semibold">Strategy / Entry Rules</div></div>
        <div className="panel-body">
          <ConfigRow label="Stop Buffer %" value={cfgValue(config.stop_buffer_pct)} />
          <ConfigRow label="HTF Lookback" value={cfgValue(config.htf_lookback)} />
          <ConfigRow label="Pivot Bars" value={cfgValue(config.pivot_bars)} />
          <ConfigRow label="Min / Max RR" value={`${cfgValue(config.min_rr)} / ${cfgValue(config.max_rr)}`} />
          {Object.keys(tfMaxRr).length > 0 && <ConfigRow label="Per-TF Max RR" value={cfgValue(tfMaxRr)} />}
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-head"><div className="text-sm font-semibold">Risk &amp; Trade Management</div></div>
        <div className="panel-body">
          <ConfigRow label="TP1 Trigger %" value={cfgValue(config.tp1_trigger_pct)} />
          <ConfigRow label="TP1 Close %" value={cfgValue(config.tp1_close_pct)} />
          <ConfigRow label="Move SL to BE on TP1" value={cfgValue(config.move_sl_to_be_on_tp1)} />
          <ConfigRow label="Signal Expiry (h)" value={cfgValue(config.signal_expiry_hours)} />
          <ConfigRow label="Max HTF Zones/Dir" value={cfgValue(config.max_htf_zones_per_dir)} />
          <ConfigRow label="Max Signals/Zone" value={cfgValue(config.max_signal_count_per_zone)} />
          <ConfigRow label="Max Consecutive Losses" value={cfgValue(config.max_consecutive_losses)} />
          <ConfigRow label="Pause After Streak (h)" value={cfgValue(config.pause_after_streak_h)} />
          {Object.keys(tfOverrides).length > 0 && <ConfigRow label="TF Overrides" value={cfgValue(tfOverrides)} />}
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-head"><div className="text-sm font-semibold">Feature Flags</div></div>
        <div className="panel-body">
          <ConfigRow label="Trend Filter" value={cfgValue(config.use_trend_filter)} />
          <ConfigRow label="Invalidation" value={cfgValue(config.use_invalidation)} />
          <ConfigRow label="Displacement Filter" value={cfgValue(config.use_displacement_filter)} />
          {config.use_displacement_filter ? (
            <>
              <ConfigRow label="Displacement ATR Period" value={cfgValue(config.displacement_atr_period)} />
              <ConfigRow label="Displacement ATR Mult" value={cfgValue(config.displacement_atr_mult)} />
              {Object.keys(tfDisplacementMult).length > 0 && (
                <ConfigRow label="Per-TF Displacement Mult" value={cfgValue(tfDisplacementMult)} />
              )}
            </>
          ) : null}
          <ConfigRow label="Session Filter" value={cfgValue(config.use_session_filter)} />
          <ConfigRow label="Multi-TF Independent Positions" value={cfgValue(config.multi_tf_independent_positions)} />
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-head"><div className="text-sm font-semibold">WebSocket Settings</div></div>
        <div className="panel-body">
          <ConfigRow label="Host" value={String(ws.host ?? "-")} />
          <ConfigRow label="Port" value={String(ws.port ?? "-")} />
          <ConfigRow label="Max Clients" value={String(ws.max_clients ?? "-")} />
          <ConfigRow label="Auth Required" value={cfgValue(ws.auth_required)} />
          <ConfigRow label="Candle Buffer (ms)" value={cfgValue(config.candle_buffer_ms)} />
          <ConfigRow label="Max Emit Lag (ms)" value={cfgValue(config.max_emit_lag_ms)} />
          <ConfigRow label="Max Spread/SL Ratio" value={cfgValue(config.max_spread_to_sl_ratio)} />
          <ConfigRow label="Max SL Zone Mult" value={cfgValue(config.max_sl_zone_mult)} />
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-head"><div className="text-sm font-semibold">Trading Hours &amp; Weekend</div></div>
        <div className="panel-body">
          <ConfigRow label="Weekend Sleep" value={cfgValue(weekend.enabled)} />
          {weekend.enabled ? (
            <>
              <ConfigRow label="Market Closes" value={weekdayTime(weekend.close_weekday, weekend.close_time)} />
              <ConfigRow label="Market Reopens" value={weekdayTime(weekend.reopen_weekday, weekend.reopen_time)} />
            </>
          ) : null}
          <ConfigRow label="Trading Disabled (manual)" value={cfgValue(trading.disabled)} />
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-head"><div className="text-sm font-semibold">Version / Build</div></div>
        <div className="panel-body">
          <ConfigRow label="Engine Version" value={version} />
          <ConfigRow label="Environment" value={String(trading.env ?? "-").toUpperCase()} />
        </div>
      </div>
    </div>
  );
}

/* ── loading shell ──────────────────────────────────────────────────────── */
function SignalLoadingShell({ status }: { status: string }) {
  const offline    = status !== "connected" && status !== "connecting";
  const connecting = status === "connecting";
  return (
    <div className="space-y-4">
      <div className="panel state-block" style={{ minHeight: 200 }}>
        <span
          className={`dot dot-${offline ? "dead" : "warn"}${offline ? "" : " pulse"}`}
          style={{ width: 10, height: 10 }}
        />
        <div className="text-sm font-medium">
          {offline
            ? "Signal engine offline"
            : connecting
            ? "Connecting to signal engine…"
            : "Waiting for first snapshot…"}
        </div>
        <p className="muted text-xs max-w-[280px] leading-5">
          {offline
            ? "Start the signal engine and reload to stream signal metrics."
            : connecting
            ? "Opening the WebSocket connection to the signal engine."
            : "Connected - waiting for the first metrics snapshot from the signal engine."}
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([0, 1, 2, 3] as const).map(i => (
          <div key={i} className="kpi">
            <div className="skeleton h-2 w-16 mb-3 rounded" />
            <div className="skeleton h-5 w-20 mb-2 rounded" />
            <div className="skeleton h-2 w-14 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── page ───────────────────────────────────────────────────────────────── */
export default function Signals() {
  const { status, metrics: snapshot, recentEvents, lastMetricsAt, isStale } = useSignalEngine();
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  /* Classify the provider's already-accumulated event stream. */
  const sigEvents = useMemo(
    () => recentEvents.filter(ev => isSignalEvent(ev.event_type)).map(normalizeSigEvent),
    [recentEvents],
  );
  const rejEvents = useMemo(
    () => recentEvents.filter(ev => isRejectionEvent(ev.event_type)),
    [recentEvents],
  );

  /* Data extraction - matches the signal engine's own build_snapshot() shape. */
  const metrics       = (snapshot?.metrics ?? {}) as Record<string, unknown>;
  const scheduler     = (snapshot?.scheduler ?? []) as unknown as SchedulerItem[];
  const activeSignals = (snapshot?.active_signals ?? []) as Record<string, unknown>[];
  const api           = (snapshot?.api ?? {}) as Record<string, unknown>;
  const config        = snapshot?.config as Record<string, unknown> | null | undefined;
  const system        = (snapshot?.system ?? {}) as Record<string, unknown>;
  const version       = String(snapshot?.version ?? "?");
  const market        = (snapshot?.market ?? null) as MarketStatus | null;
  const wsInfo        = (snapshot?.websocket ?? {}) as Record<string, unknown>;
  const clients       = (wsInfo.clients ?? []) as ClientRow[];
  const errorRecords  = ((snapshot?.errors as Record<string, unknown> | undefined)?.recent ?? []) as ErrorRecord[];

  return (
    <div className="page-wrap space-y-5">
      <PageHeader
        eyebrow="Signal domain"
        title="Signal Performance"
        description="Signal engine health, strategy metrics, and symbol telemetry."
      />

      {/* Loading state - shown until the first snapshot arrives */}
      {!snapshot && <SignalLoadingShell status={status} />}

      {snapshot && <>

      <div className="mb-5">
        <MarketStatusBanner market={market} />
      </div>

      <Tabs
        tabs={TABS.map(tab => ({
          id: tab.id,
          label: tab.label,
          count:
            tab.id === "signals"    && sigEvents.length ? sigEvents.length :
            tab.id === "rejections" && rejEvents.length ? rejEvents.length :
            tab.id === "events"     && recentEvents.length ? recentEvents.length :
            tab.id === "clients"    && clients.length ? clients.length : undefined,
        }))}
        active={activeTab}
        onChange={id => setActiveTab(id as TabId)}
      />

      {activeTab === "overview" && (
        <OverviewTab
          metrics={metrics} scheduler={scheduler} activeSignals={activeSignals}
          system={system} version={version} clientCount={clients.length}
          connStatus={status} lastMetricsAt={lastMetricsAt} isStale={isStale}
        />
      )}
      {activeTab === "configuration" && <ConfigTab config={config} version={version} />}
      {activeTab === "metrics"       && <MetricsTab metrics={metrics} api={api} />}
      {activeTab === "performance"   && <PerformanceTab metrics={metrics} api={api} system={system} />}
      {activeTab === "strategies"    && <ActiveStrategiesTab config={config} />}
      {activeTab === "clients"       && <ConnectedClientsTab clients={clients} />}
      {activeTab === "signals"       && <SignalsTab signals={sigEvents} />}
      {activeTab === "rejections"    && <RejectionsTab items={rejEvents} />}
      {activeTab === "events"        && <EventsTab items={recentEvents} />}
      {activeTab === "logs"          && <LogsTab records={errorRecords} />}
      </>}
    </div>
  );
}
