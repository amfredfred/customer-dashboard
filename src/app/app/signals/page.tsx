"use client";

import { PageHeader, SectionHead } from "@/components/metric-detail";
import { useGateway } from "@/components/gateway-provider";
import { useEffect, useRef, useState } from "react";

/* ── types ─────────────────────────────────────────────────────────────── */
type Tone   = "normal" | "good" | "warn" | "danger";
type TabId  = "overview" | "metrics" | "signals" | "rejections" | "logs" | "config";

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
  { id: "overview",   label: "Overview"    },
  { id: "metrics",    label: "Metrics"     },
  { id: "signals",    label: "Signals"     },
  { id: "rejections", label: "Rejections"  },
  { id: "logs",       label: "Logs"        },
  { id: "config",     label: "Config"      },
];

/* ── event classification ───────────────────────────────────────────────── */
function isRejectionEvent(t: string): boolean {
  return t.includes("reject") || t.includes("invalid") || t.includes("stale")
      || t.includes("blocked") || t.includes("filtered");
}
function isSignalEvent(t: string): boolean {
  return t.startsWith("signal.") && !isRejectionEvent(t);
}

const EVENT_COLORS: Record<string, string> = {
  "signal.emitted":          "#3ddc97",
  "signal.triggered":        "#3ddc97",
  "signal.rejected":         "#f43f5e",
  "signal.invalid":          "#f43f5e",
  "signal.stale":            "#f5b942",
  "signal.filtered":         "#f5b942",
  "signal.trend_blocked":    "#f5b942",
  "signal.quality_blocked":  "#f5b942",
  "signal.decision_blocked": "#f5b942",
  "signal.dedup_blocked":    "rgba(255,255,255,.35)",
  "metrics.snapshot":        "rgba(255,255,255,.2)",
  "connected":               "#3ddc97",
  "subscribed":              "#3ddc97",
};
function evColor(t: string): string { return EVENT_COLORS[t] ?? "rgba(255,255,255,.45)"; }

/* ── helpers ────────────────────────────────────────────────────────────── */
function isN(v: unknown): v is number { return typeof v === "number" && !isNaN(v); }
function cnt(v: unknown): string  { return isN(v) ? v.toLocaleString("en-US") : "—"; }
function msf(v: unknown): string  { return isN(v) ? `${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}ms` : "—"; }
function pct(v: unknown): string  { return isN(v) ? `${v.toFixed(1)}%` : "—"; }

function pick(m: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) { if (isN(m[k])) return m[k] as number; }
  return undefined;
}

function sumPrefix(data: Record<string, number>, prefix: string): number {
  return Object.entries(data).filter(([k]) => k.startsWith(prefix)).reduce((s, [, v]) => s + v, 0);
}

function fmtTs(ts: unknown): string {
  if (!ts) return "—";
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
  if (!v) return "—";
  const d = new Date(v < 1e12 ? v * 1000 : v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("en-US", { hour12: false });
}

function fmtPrice(n: number): string {
  if (n === 0) return "—";
  if (n > 1000) return n.toFixed(2);
  if (n > 10)   return n.toFixed(3);
  return n.toFixed(5);
}

function cfgValue(v: unknown): string {
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v))       return v.join(", ");
  if (v && typeof v === "object") return JSON.stringify(v);
  return String(v ?? "—");
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
function kpiCls(t: Tone): string {
  return t === "good" ? " kpi-good" : t === "warn" ? " kpi-warn" : t === "danger" ? " kpi-danger" : "";
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
    id:         ev.id,   // use event ID — unique by seenRef dedup, stable across re-renders
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
function StatCard({ label, value, detail, tone = "normal" }: {
  label: string; value: string; detail?: string; tone?: Tone;
}) {
  return (
    <div className={`kpi${kpiCls(tone)}`}>
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value${valCls(tone)}`}>{value}</div>
      {detail && <div className="kpi-detail">{detail}</div>}
    </div>
  );
}
function MeterBar({ value, tone = "normal" }: { value?: number; tone?: Tone }) {
  const p = value === undefined || isNaN(value) ? undefined : Math.max(0, Math.min(100, value));
  const bg = tone === "good" ? "#3ddc97" : tone === "warn" ? "#f5b942" : tone === "danger" ? "#f43f5e" : "rgba(255,255,255,.22)";
  return (
    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.06)", marginTop: 8 }}>
      {p !== undefined && <div className="h-full rounded-full" style={{ width: `${p}%`, background: bg, transition: "width .3s" }} />}
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

/* ── Overview tab ───────────────────────────────────────────────────────── */
function OverviewTab({ metrics, scheduler, activeSignals }: {
  metrics: Record<string, unknown>;
  scheduler: SchedulerItem[];
  activeSignals: Record<string, unknown>[];
}) {
  const counters = (metrics.raw_counters ?? {}) as Record<string, number>;
  const gauges   = (metrics.raw_gauges   ?? {}) as Record<string, number>;
  const pairScans     = sumPrefix(counters, "scanner.pair_scans.");
  const trendBlocked  = sumPrefix(counters, "signals.trend_blocked.");
  const signalsEmitted = pick(metrics, "signals_emitted") ?? counters["signals.emitted"];

  return (
    <div className="space-y-5">
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
          <StatCard label="WebSocket Clients" value={cnt(pick(metrics, "websocket_clients") ?? gauges["websocket.clients"])}
            detail="dashboards connected" />
        </div>
      </section>

      <section>
        <SectionHead label="Signal Funnel" />
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          <StatCard label="Rejections Found"  value={cnt(counters["signals.rejections_found"])} />
          <StatCard label="Signals Emitted"   value={cnt(signalsEmitted)}
            tone={isN(signalsEmitted) && signalsEmitted > 0 ? "good" : "normal"} />
          <StatCard label="Stale Skipped"     value={cnt(pick(metrics, "signals_stale_skipped"))}
            tone={errTone(pick(metrics, "signals_stale_skipped"))} />
          <StatCard label="No Rejection"      value={cnt(pick(metrics, "signals_no_rejection"))}
            detail={`${cnt(pick(metrics, "signals_no_ltf_range"))} no LTF range`} />
          <StatCard label="Trend Blocked"     value={cnt(trendBlocked)} />
          <StatCard label="Quality Blocked"   value={cnt(counters["signals.quality_blocked"])} />
          <StatCard label="Dedup Blocked"     value={cnt(pick(metrics, "signals_dedup_blocked"))} />
          <StatCard label="Decision Blocked"  value={cnt(pick(metrics, "signals_decision_blocked"))} />
        </div>
      </section>

      <section>
        <SectionHead label="Latency" />
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

      <div className="grid xl:grid-cols-[1fr_260px] gap-5">
        <section className="min-w-0">
          <SectionHead label="Scheduler" />
          {scheduler.length === 0 ? (
            <div className="panel state-block">
              <div className="font-medium">No scheduler rows</div>
              <p className="muted text-xs">Symbol scan schedule will appear when the signal engine connects.</p>
            </div>
          ) : (
            <div className="panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-max text-xs">
                  <thead>
                    <tr>{["Symbol", "Mode", "Ticks", "Last Fired", "Avg MS", "P95 MS"].map(c => <TH key={c}>{c}</TH>)}</tr>
                  </thead>
                  <tbody>
                    {scheduler.map((item, i) => {
                      const stats = item.tick_stats ? Object.values(item.tick_stats)[0] ?? {} : {};
                      return (
                        <tr key={item.symbol ?? i} style={TR_BORDER}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.025)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "")}>
                          <TD mono><span className="font-bold text-white">{item.symbol ?? "—"}</span></TD>
                          <TD><span className="muted">{item.mode ?? "—"}</span></TD>
                          <TD mono>{cnt(item.tick_count)}</TD>
                          <TD mono><span className="muted">{shortTime(item.last_fired_at)}</span></TD>
                          <TD mono><span className="muted">{isN(stats.avg_ms) ? msf(stats.avg_ms) : "—"}</span></TD>
                          <TD mono><span className="muted">{isN(stats.p95_ms) ? msf(stats.p95_ms) : "—"}</span></TD>
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
                    const tf  = [htf, ltf].filter(Boolean).join("/") || String(sig.timeframe ?? sig.tf ?? "—");
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
                        <TD mono><span className="muted">{entry > 0 ? fmtPrice(entry) : "—"}</span></TD>
                        <TD mono><span className="muted">{sl    > 0 ? fmtPrice(sl)    : "—"}</span></TD>
                        <TD mono><span className="muted">{tp    > 0 ? fmtPrice(tp)    : "—"}</span></TD>
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
            <StatCard label="Pair Scans"        value={cnt(sumPrefix(counters, "scanner.pair_scans."))} />
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

/* ── Signals tab ────────────────────────────────────────────────────────── */
function SignalsTab({ signals }: { signals: NSig[] }) {
  if (!signals.length) {
    return (
      <div className="panel state-block">
        <div className="font-medium">No signal events yet</div>
        <p className="muted text-xs">
          Signal emission events accumulate here in real time as they arrive from the signal engine.
        </p>
      </div>
    );
  }
  return (
    <div className="panel overflow-hidden">
      <div className="panel-head">
        <div>
          <div className="text-sm font-semibold">Signal Events</div>
          <p className="muted text-xs mt-0.5">
            {signals.length} signal{signals.length !== 1 ? "s" : ""} accumulated
          </p>
        </div>
        <span className="badge badge-green">{signals.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-xs">
          <thead>
            <tr>{["Time", "Symbol", "TF", "Strategy", "Side", "Conf", "Entry", "SL", "TP", "Setup", "Status"].map(c => (
              <TH key={c}>{c}</TH>
            ))}</tr>
          </thead>
          <tbody>
            {signals.map((sig, i) => (
              <tr key={sig.id ?? i} style={TR_BORDER}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.025)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}>
                <TD mono><span className="muted">{fmtTs(sig.timestamp)}</span></TD>
                <TD mono><span className="font-bold text-white">{sig.symbol}</span></TD>
                <TD>
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(255,255,255,.06)", color: "var(--text-soft)" }}>
                    {sig.timeframe}
                  </span>
                </TD>
                <TD><span className="muted">{sig.strategy}</span></TD>
                <TD><DirBadge dir={sig.direction} /></TD>
                <TD mono>
                  {sig.confidence !== undefined ? `${(sig.confidence * 100).toFixed(0)}%` : "—"}
                </TD>
                <TD mono>{sig.entry > 0 ? fmtPrice(sig.entry) : "—"}</TD>
                <TD mono><span className="muted">{sig.stopLoss > 0 ? fmtPrice(sig.stopLoss) : "—"}</span></TD>
                <TD mono><span className="muted">{sig.takeProfit > 0 ? fmtPrice(sig.takeProfit) : "—"}</span></TD>
                <TD>
                  <span className="muted block max-w-[200px] truncate">{sig.setup ?? "—"}</span>
                </TD>
                <TD>
                  <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(61,220,151,.12)", color: "#3ddc97" }}>
                    {sig.status}
                  </span>
                </TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Rejections tab ─────────────────────────────────────────────────────── */
function RejectionsTab({ items }: { items: EventEntry[] }) {
  if (!items.length) {
    return (
      <div className="panel state-block">
        <div className="font-medium">No rejections yet</div>
        <p className="muted text-xs">
          Signal filter and rejection events will appear here as they arrive from the signal engine.
        </p>
      </div>
    );
  }
  return (
    <div className="panel overflow-hidden">
      <div className="panel-head">
        <div>
          <div className="text-sm font-semibold">Signal Rejections</div>
          <p className="muted text-xs mt-0.5">{items.length} rejection{items.length !== 1 ? "s" : ""} accumulated</p>
        </div>
        <span className="badge" style={{ background: "rgba(244,63,94,.15)", color: "#f43f5e", border: "1px solid rgba(244,63,94,.3)" }}>
          {items.length}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-xs">
          <thead>
            <tr>{["Time", "Filter", "Symbol", "Strategy", "Reason"].map(c => <TH key={c}>{c}</TH>)}</tr>
          </thead>
          <tbody>
            {items.map(ev => {
              const d = ev.data;
              const filterLabel = ev.event_type.split(".").pop()?.replace(/_/g, " ") ?? ev.event_type;
              return (
                <tr key={ev.id} style={TR_BORDER}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.025)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <TD mono><span className="muted">{fmtTs(ev.ts)}</span></TD>
                  <TD>
                    <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded"
                          style={{ background: "rgba(244,63,94,.12)", color: "#f43f5e" }}>
                      {filterLabel}
                    </span>
                  </TD>
                  <TD mono><span className="font-bold text-white">{String(d.symbol ?? "—")}</span></TD>
                  <TD><span className="muted">{String(d.strategy ?? d.pattern ?? "—")}</span></TD>
                  <TD>
                    <span className="muted block max-w-[320px] truncate">
                      {String(d.reason ?? d.message ?? ev.summary ?? "—")}
                    </span>
                  </TD>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Logs tab ───────────────────────────────────────────────────────────── */
function LogsTab({ items }: { items: EventEntry[] }) {
  if (!items.length) {
    return (
      <div className="panel state-block">
        <div className="font-medium">No events yet</div>
        <p className="muted text-xs">All signal engine events forwarded by the gateway will appear here.</p>
      </div>
    );
  }
  return (
    <div className="panel overflow-hidden">
      <div className="panel-head">
        <div>
          <div className="text-sm font-semibold">Event Log</div>
          <p className="muted text-xs mt-0.5">{items.length} event{items.length !== 1 ? "s" : ""} (max 500)</p>
        </div>
        <span className="badge badge-muted">{items.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-xs">
          <thead>
            <tr>{["Time", "Event Type", "Summary"].map(c => <TH key={c}>{c}</TH>)}</tr>
          </thead>
          <tbody>
            {items.map(ev => (
              <tr key={ev.id} style={TR_BORDER}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.025)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}>
                <TD mono><span className="muted">{fmtTs(ev.ts)}</span></TD>
                <TD>
                  <span className="font-mono text-[11px] font-semibold"
                        style={{ color: evColor(ev.event_type) }}>
                    {ev.event_type}
                  </span>
                </TD>
                <TD>
                  <span className="muted block max-w-[440px] truncate">{ev.summary}</span>
                </TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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

type RiskGuard = { id: string; name: string; description?: string; status: string; current_value: number; threshold: number; unit: string };

function ConfigTab({ config }: { config: Record<string, unknown> | null | undefined }) {
  if (!config) {
    return (
      <div className="panel state-block">
        <div className="font-medium">Config not yet received</div>
        <p className="muted text-xs">Engine config arrives with the first metrics snapshot after the signal engine connects.</p>
      </div>
    );
  }

  const reservedKeys = new Set(["mode", "version", "magic", "riskGuards", "metrics", "symbols"]);
  const effectiveConfig = Object.entries(config).filter(([k]) => !reservedKeys.has(k));
  const riskGuards = (config.riskGuards ?? []) as RiskGuard[];

  return (
    <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
      {/* Engine */}
      <div className="panel overflow-hidden">
        <div className="panel-head">
          <div className="text-sm font-semibold">Engine</div>
        </div>
        <div className="panel-body">
          <ConfigRow label="Mode"    value={String(config.mode ?? "—").toUpperCase()} />
          {config.version !== undefined && <ConfigRow label="Version" value={String(config.version)} />}
          {config.magic   !== undefined && <ConfigRow label="Magic #" value={String(config.magic)} />}
          {Array.isArray(config.symbols) && (
            <ConfigRow label="Symbols" value={(config.symbols as string[]).join(", ")} />
          )}
        </div>
      </div>

      {effectiveConfig.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="panel-head">
            <div className="text-sm font-semibold">Effective Configuration</div>
            <span className="badge badge-muted">{effectiveConfig.length}</span>
          </div>
          <div className="panel-body">
            {effectiveConfig.map(([k, v]) => (
              <ConfigRow key={k} label={k.replace(/_/g, " ")} value={cfgValue(v)} />
            ))}
          </div>
        </div>
      )}

      {riskGuards.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="panel-head">
            <div className="text-sm font-semibold">Risk Guards</div>
            <span className="badge badge-muted">{riskGuards.length}</span>
          </div>
          <div className="panel-body space-y-4">
            {riskGuards.map(g => {
              const guardPct = g.threshold > 0 ? (g.current_value / g.threshold) * 100 : undefined;
              const isActive = g.status.toUpperCase() === "ACTIVE";
              const tone: Tone = !isActive ? "normal"
                : isN(guardPct) && guardPct >= 90 ? "danger"
                : isN(guardPct) && guardPct >= 70 ? "warn"
                : "good";
              return (
                <div key={g.id}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium">{g.name}</span>
                    <span className={`badge ${isActive ? "badge-green" : "badge-muted"}`}>{g.status}</span>
                  </div>
                  {g.description && <p className="text-xs muted mb-1">{g.description}</p>}
                  <div className="flex justify-between text-xs muted font-mono">
                    <span className={valCls(tone)}>{g.current_value} {g.unit}</span>
                    <span>limit {g.threshold} {g.unit}</span>
                  </div>
                  {isN(guardPct) && <MeterBar value={guardPct} tone={tone} />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── loading shell ──────────────────────────────────────────────────────── */
function SignalLoadingShell({ gwStatus }: { gwStatus: string }) {
  const offline    = gwStatus !== "authenticated" && gwStatus !== "connecting";
  const connecting = gwStatus === "connecting";
  return (
    <div className="space-y-4">
      <div className="panel state-block" style={{ minHeight: 200 }}>
        <span
          className={`dot dot-${offline ? "dead" : "warn"}${offline ? "" : " pulse"}`}
          style={{ width: 10, height: 10 }}
        />
        <div className="text-sm font-medium">
          {offline
            ? "Gateway offline"
            : connecting
            ? "Connecting to gateway…"
            : "Waiting for signal engine…"}
        </div>
        <p className="muted text-xs max-w-[280px] leading-5">
          {offline
            ? "Start the execution gateway and reload to stream signal metrics."
            : connecting
            ? "Authenticating with the gateway — this only takes a moment."
            : "Gateway is subscribed and waiting for the first metrics snapshot from the upstream signal engine."}
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
  const gateway = useGateway();
  const { signalMetrics, status: gwStatus } = gateway;
  const [nowMs,     setNowMs]     = useState(0);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  /* Event accumulation */
  const seenRef = useRef<Set<string>>(new Set());
  const [sigEvents, setSigEvents] = useState<NSig[]>([]);
  const [rejEvents, setRejEvents] = useState<EventEntry[]>([]);
  const [logEvents, setLogEvents] = useState<EventEntry[]>([]);

  /* Clock — staleness detection */
  useEffect(() => {
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const snapshot = signalMetrics;

  /* Accumulate events from each incoming snapshot */
  useEffect(() => {
    if (!snapshot) return;
    const recentEvents = (snapshot as Record<string, unknown>).recent_events as EventEntry[] | undefined;
    if (!recentEvents?.length) return;

    const newSigs: NSig[]       = [];
    const newRej:  EventEntry[] = [];
    const newLog:  EventEntry[] = [];

    for (const ev of recentEvents) {
      if (seenRef.current.has(ev.id)) continue;
      seenRef.current.add(ev.id);
      newLog.push(ev);
      if (isRejectionEvent(ev.event_type))  newRej.push(ev);
      else if (isSignalEvent(ev.event_type)) newSigs.push(normalizeSigEvent(ev));
    }

    if (newLog.length === 0) return;
    setLogEvents(prev => [...newLog, ...prev].slice(0, 500));
    if (newRej.length)  setRejEvents(prev => [...newRej,  ...prev].slice(0, 200));
    if (newSigs.length) setSigEvents(prev => [...newSigs, ...prev].slice(0, 200));
  }, [snapshot]);

  /* Data extraction */
  const metrics       = (snapshot?.metrics       ?? {}) as Record<string, unknown>;
  const scheduler     = (snapshot?.scheduler     ?? []) as unknown as SchedulerItem[];
  const activeSignals = (snapshot?.active_signals ?? []) as Record<string, unknown>[];
  const api           = (snapshot?.api           ?? {}) as Record<string, unknown>;
  const config        = (snapshot as Record<string, unknown> | null)?.config as Record<string, unknown> | null | undefined;
  const observed      = snapshot?.observed_at;
  const observedMs    = observed
    ? (typeof observed === "number" ? (observed < 1e12 ? observed * 1000 : observed) : 0)
    : undefined;
  const ageMs = observedMs && nowMs ? nowMs - observedMs : undefined;

  /* Health */
  const scannerTicks = typeof metrics.scanner_ticks === "number" ? metrics.scanner_ticks : 0;
  const tickErrors   = typeof metrics.scanner_tick_errors === "number" ? metrics.scanner_tick_errors : 0;
  const mt5Calls     = typeof metrics.mt5_calls === "number" ? metrics.mt5_calls : 0;
  const mt5Errors    = typeof metrics.mt5_errors === "number" ? metrics.mt5_errors : 0;
  const errorRate    = ((tickErrors + mt5Errors) / Math.max(scannerTicks + mt5Calls, 1)) * 100;
  const health: { label: string; tone: Tone } =
    gwStatus !== "authenticated"
      ? { label: "Offline",    tone: "danger" }
      : !snapshot
        ? { label: "Connecting", tone: "warn"   }
        : ageMs !== undefined && ageMs > 15000
          ? { label: "Stale",    tone: "warn"   }
          : errorRate >= 1
            ? { label: "Degraded", tone: "warn" }
            : { label: "Healthy",  tone: "good" };

  return (
    <div className="page-wrap space-y-5">
      <PageHeader
        eyebrow="Public signal domain"
        title="Signal Performance"
        description="Sanitised signal engine health, strategy metrics, and symbol telemetry. No broker account data appears here."
        right={
          <div className={`kpi${kpiCls(health.tone)}`} style={{ minWidth: 120, padding: "8px 14px" }}>
            <div className="kpi-label text-[10px]">Engine Status</div>
            <div className={`kpi-value text-sm${valCls(health.tone)}`}>{health.label}</div>
          </div>
        }
      />

      {/* Loading state — shown until the first snapshot arrives */}
      {!snapshot && <SignalLoadingShell gwStatus={gwStatus} />}

      {/* Tab strip — only rendered once we have real data */}
      {snapshot && <>
      {/* Tab strip */}
      <div className="overflow-x-auto no-scrollbar">
        <div className="flex gap-0.5 p-1 rounded-lg w-fit"
             style={{ background: "var(--surface-raised)", border: "1px solid var(--line)" }}>
          {TABS.map(tab => {
            const badgeCount =
              tab.id === "signals"    ? sigEvents.length :
              tab.id === "rejections" ? rejEvents.length :
              tab.id === "logs"       ? logEvents.length : 0;
            const isRej = tab.id === "rejections" && badgeCount > 0;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap"
                style={{
                  background: activeTab === tab.id ? "rgba(255,255,255,.08)" : "transparent",
                  color:      activeTab === tab.id ? "#fff" : "rgba(255,255,255,.4)",
                }}
              >
                {tab.label}
                {badgeCount > 0 && (
                  <span
                    className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold tabular-nums"
                    style={{
                      background: isRej ? "rgba(244,63,94,.25)" : "rgba(255,255,255,.12)",
                      color:      isRej ? "#f43f5e"             : "rgba(255,255,255,.5)",
                    }}
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "overview"   && <OverviewTab    metrics={metrics} scheduler={scheduler} activeSignals={activeSignals} />}
      {activeTab === "metrics"    && <MetricsTab     metrics={metrics} api={api} />}
      {activeTab === "signals"    && <SignalsTab      signals={sigEvents} />}
      {activeTab === "rejections" && <RejectionsTab  items={rejEvents} />}
      {activeTab === "logs"       && <LogsTab        items={logEvents} />}
      {activeTab === "config"     && <ConfigTab      config={config} />}
      </>}
    </div>
  );
}
