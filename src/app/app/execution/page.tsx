"use client";

import { PageHeader, SectionHead } from "@/components/metric-detail";
import { useExecutionEngine } from "@/components/execution-engine-provider";
import { useState, type ReactNode } from "react";
import { MetricCard } from "@/components/ui/metric-card";
import { Tabs } from "@/components/ui/tabs";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { EventFeed, type FeedEvent, type FeedTone } from "@/components/ui/event-feed";
import { SurfaceSection } from "@/components/ui/surface";
import { StatusBadge } from "@/components/ui/status-badge";
import { StaleBanner, LastUpdated } from "@/components/ui/stale-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { Layers, Radio, Settings2, ShieldOff, Activity as ActivityIcon, FileText, Search, type LucideIcon } from "lucide-react";

/* ── types ─────────────────────────────────────────────────────────────── */
type Tone = "normal" | "good" | "warn" | "danger";
type TabId =
  | "overview" | "configuration" | "positions" | "signals" | "metrics" | "performance"
  | "guards" | "rejections" | "activity" | "events" | "logs";

/** Execution events accumulated from the execution engine's live event stream. */
interface EventEntry {
  id:         string;
  event_type: string;
  ts:         string;
  summary:    string;
  data:       Record<string, unknown>;
}

interface NPos {
  ticket: string | number;
  symbol: string;
  direction: "BUY" | "SELL";
  openPrice: number;
  stopLoss: number;
  takeProfit: number;
  volume: number;
  profit: number;
  strategy?: string;
}

interface NSig {
  id: string;
  symbol: string;
  timeframe: string;
  strategy: string;
  direction: "BUY" | "SELL";
  confidence?: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  setup?: string;
  status?: string;
  timestamp?: string;
}

interface RGuard {
  id: string;
  name: string;
  description?: string;
  status: string;
  current_value: number;
  threshold: number;
  unit: string;
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview",      label: "Overview"          },
  { id: "configuration", label: "Configuration"      },
  { id: "metrics",       label: "Runtime Metrics"    },
  { id: "performance",   label: "Performance"        },
  { id: "positions",     label: "Positions"          },
  { id: "signals",       label: "Recent Signals"     },
  { id: "guards",        label: "Risk Guards"        },
  { id: "rejections",    label: "Rejections"         },
  { id: "activity",      label: "Activity"           },
  { id: "events",        label: "Recent Events"      },
  { id: "logs",          label: "Logs"               },
];

/* ── event classification ───────────────────────────────────────────────── */
const REJECTION_EVENT_TYPES = new Set([
  "strategy.rejected", "signal.rejected", "risk.rejected",
  "parity.warning",    "signal.filtered",
  "trade.error",   // order failed (e.g. AutoTrading disabled, MT5 rejection)
]);
const ACTIVITY_EVENT_TYPES = new Set([
  "trade.opened",    "trade.closed",    "trade.tp1_hit",
  "trade.tp2_hit",   "trade.sl_hit",    "order.filled",
  "position.partial_tp", "position.updated", "position.sync",
]);

/* ── format helpers ─────────────────────────────────────────────────────── */
function isN(v: unknown): v is number { return typeof v === "number" && !isNaN(v); }

function money(v: unknown, signed = false): string {
  if (!isN(v)) return "-";
  const sign = signed && v >= 0 ? "+" : v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(v: unknown, signed = false): string {
  if (!isN(v)) return "-";
  return `${signed && v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function cnt(v: unknown): string {
  if (!isN(v)) return "-";
  return v.toLocaleString("en-US");
}

function ratio(v: unknown): string {
  if (!isN(v)) return "-";
  return v.toFixed(2);
}

function msf(v: unknown): string {
  if (!isN(v)) return "-";
  return `${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}ms`;
}

function fmtPrice(n: number): string {
  if (n === 0) return "-";
  if (n > 1000) return n.toFixed(2);
  if (n > 10)   return n.toFixed(3);
  return n.toFixed(5);
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

/* ── tone helpers ───────────────────────────────────────────────────────── */
function signedTone(v: unknown): Tone {
  return !isN(v) ? "normal" : v > 0 ? "good" : v < 0 ? "danger" : "normal";
}
function usageTone(v: unknown): Tone {
  return !isN(v) ? "normal" : v >= 90 ? "danger" : v >= 70 ? "warn" : "good";
}
function latTone(v: unknown): Tone {
  return !isN(v) ? "normal" : v > 3000 ? "danger" : v > 1000 ? "warn" : "good";
}

function kpiCls(t: Tone): string {
  return t === "good" ? " kpi-good" : t === "warn" ? " kpi-warn" : t === "danger" ? " kpi-danger" : "";
}
function valCls(t: Tone): string {
  return t === "good" ? " good" : t === "warn" ? " warn" : t === "danger" ? " danger" : "";
}

/* ── metric accessor ────────────────────────────────────────────────────── */
function pick(m: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = m[k];
    if (typeof v === "number" && !isNaN(v)) return v;
  }
  return undefined;
}

function pickStr(m: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = m[k];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return undefined;
}

/* ── normalizers ────────────────────────────────────────────────────────── */
function normalizeDir(v: unknown): "BUY" | "SELL" {
  const s = String(v ?? "").toUpperCase();
  return s === "SELL" || s === "SHORT" ? "SELL" : "BUY";
}

function normalizePos(t: Record<string, unknown>): NPos {
  return {
    ticket:     (t.ticket ?? t.id ?? "-") as string | number,
    symbol:     String(t.symbol ?? "?"),
    direction:  normalizeDir(t.side ?? t.direction),
    openPrice:  Number(t.entry_price ?? t.openPrice ?? t.open_price ?? 0) || 0,
    stopLoss:   Number(t.sl ?? t.stopLoss ?? t.stop_loss ?? 0) || 0,
    takeProfit: Number(t.tp2 ?? t.tp1 ?? t.takeProfit ?? t.tp ?? 0) || 0,
    volume:     Number(t.lots ?? t.volume ?? 0) || 0,
    profit:     Number(t.pnl ?? t.profit ?? 0),
    strategy:   t.strategy ? String(t.strategy) : undefined,
  };
}

function normalizeSig(raw: Record<string, unknown>, idx: number): NSig {
  const rawConf = raw.confidence ?? raw.strength;
  const conf = rawConf !== undefined
    ? (raw.strength !== undefined ? Number(raw.strength) / 100 : Number(rawConf))
    : undefined;
  return {
    id:         String(raw.id ?? idx),
    symbol:     String(raw.symbol ?? "?"),
    timeframe:  String(raw.timeframe ?? raw.tf ?? "-"),
    strategy:   String(raw.strategy ?? raw.strat ?? "-"),
    direction:  normalizeDir(raw.direction ?? raw.side ?? raw.dir),
    confidence: conf !== undefined && !isNaN(conf) ? conf : undefined,
    entry:      Number(raw.entry ?? raw.entry_price ?? raw.entryPrice ?? 0) || 0,
    stopLoss:   Number(raw.stopLoss ?? raw.stop_loss ?? raw.sl ?? 0) || 0,
    takeProfit: Number(raw.takeProfit ?? raw.take_profit ?? raw.tp ?? raw.tp1 ?? raw.tp2 ?? 0) || 0,
    setup:      raw.setup ? String(raw.setup) : raw.reason ? String(raw.reason) : undefined,
    status:     raw.status ? String(raw.status).toUpperCase() : undefined,
    timestamp:  (raw.timestamp ?? raw.ts ?? raw.time)
                  ? String(raw.timestamp ?? raw.ts ?? raw.time)
                  : undefined,
  };
}

/* ── shared primitives ──────────────────────────────────────────────────── */
function MeterBar({ value, tone = "normal" }: { value?: number; tone?: Tone }) {
  const p = value === undefined || isNaN(value) ? undefined : Math.max(0, Math.min(100, value));
  const bg =
    tone === "good"   ? "var(--success)" :
    tone === "warn"   ? "var(--warning)" :
    tone === "danger" ? "var(--danger)"  :
    "rgba(255,255,255,.22)";
  return (
    <div className="meter-track" style={{ marginTop: 8 }}>
      {p !== undefined && (
        <div className="meter-fill" style={{ width: `${p}%`, background: bg }} />
      )}
    </div>
  );
}

/** 0-100 scale, same danger/warn/good split as usageTone (>=90 / >=70). */
const ZONE_BREAKS = { warn: 70, danger: 90 };

/** Meter bar with fixed green/amber/red zone bands plus a marker at the live value. */
function ZoneMeterBar({ value }: { value?: number }) {
  const p = value === undefined || isNaN(value) ? undefined : Math.max(0, Math.min(100, value));
  return (
    <div style={{ position: "relative", height: 8, borderRadius: 4, overflow: "hidden", marginTop: 8, background: "rgba(255,255,255,.06)" }}>
      <div style={{ position: "absolute", inset: 0, left: 0, width: `${ZONE_BREAKS.warn}%`, background: "var(--success)", opacity: 0.5 }} />
      <div style={{ position: "absolute", inset: 0, left: `${ZONE_BREAKS.warn}%`, width: `${ZONE_BREAKS.danger - ZONE_BREAKS.warn}%`, background: "var(--warning)", opacity: 0.5 }} />
      <div style={{ position: "absolute", inset: 0, left: `${ZONE_BREAKS.danger}%`, width: `${100 - ZONE_BREAKS.danger}%`, background: "var(--danger)", opacity: 0.5 }} />
      {p !== undefined && (
        <div style={{ position: "absolute", top: -2, left: `calc(${p}% - 1px)`, width: 2, height: 12, background: "var(--text)" }} />
      )}
    </div>
  );
}

/** Point on a semicircle (left=0%, top=50%, right=100%), centered at (cx,cy), radius r. */
function arcPoint(cx: number, cy: number, r: number, pct: number): [number, number] {
  const theta = (Math.PI * (100 - pct)) / 100; // 0% -> PI (left), 100% -> 0 (right)
  return [cx + r * Math.cos(theta), cy - r * Math.sin(theta)];
}

function arcPath(cx: number, cy: number, r: number, fromPct: number, toPct: number): string {
  const [x1, y1] = arcPoint(cx, cy, r, fromPct);
  const [x2, y2] = arcPoint(cx, cy, r, toPct);
  // pct maps directly to degrees * 1.8 (100% = 180deg), so the large-arc
  // flag only matters past a 100pt span - which never happens for a zone
  // bounded within a single 0-100 semicircle. Kept explicit, not hardcoded
  // to 0, in case this is ever reused for a span that could exceed it.
  const largeArc = toPct - fromPct > 100 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

/**
 * Speedometer-style semicircle gauge: colored zone arc + needle + centered readout.
 * `invert`: zones assume "higher is worse, toward a redline" by default (danger at
 * the high end) - set for "higher is better" metrics (danger at the low end instead).
 */
function RadialGauge({ value, display, tone = "normal", invert = false }: {
  value?: number; display: string; tone?: Tone; invert?: boolean;
}) {
  const cx = 100, cy = 96, r = 74;
  const p = value === undefined || isNaN(value) ? 0 : Math.max(0, Math.min(100, value));
  const [needleX, needleY] = arcPoint(cx, cy, r - 12, p);
  const needleColor =
    tone === "good" ? "var(--success)" : tone === "warn" ? "var(--warning)" :
    tone === "danger" ? "var(--danger)" : "var(--text)";
  const zones = invert
    ? [
        { from: 0, to: 100 - ZONE_BREAKS.danger, color: "var(--danger)" },
        { from: 100 - ZONE_BREAKS.danger, to: 100 - ZONE_BREAKS.warn, color: "var(--warning)" },
        { from: 100 - ZONE_BREAKS.warn, to: 100, color: "var(--success)" },
      ]
    : [
        { from: 0, to: ZONE_BREAKS.warn, color: "var(--success)" },
        { from: ZONE_BREAKS.warn, to: ZONE_BREAKS.danger, color: "var(--warning)" },
        { from: ZONE_BREAKS.danger, to: 100, color: "var(--danger)" },
      ];
  return (
    <svg viewBox="0 0 200 118" style={{ width: "100%", maxWidth: 200, margin: "4px auto 0" }}>
      {zones.map(z => (
        <path key={z.color} d={arcPath(cx, cy, r, z.from, z.to)} fill="none" stroke={z.color} strokeWidth={12} strokeLinecap="round" opacity={0.55} />
      ))}
      <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke={needleColor} strokeWidth={3} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={5} fill={needleColor} />
      <text x={cx} y={cy - 14} textAnchor="middle" fontSize={22} fontWeight={600} fill="var(--text)" className="tabular-nums">{display}</text>
    </svg>
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

function SigBadge({ status }: { status?: string }) {
  const s = String(status ?? "UNKNOWN");
  const isReject  = s.includes("REJECT");
  const isOk      = s.includes("OPEN") || s.includes("EXEC") || s.includes("APPROV");
  const isPending = s.includes("TRIGGER") || s.includes("PENDING");
  const [bg, col] =
    isReject  ? ["rgba(244,63,94,.12)",  "#f43f5e"] :
    isOk      ? ["rgba(61,220,151,.12)", "#3ddc97"] :
    isPending ? ["rgba(245,185,66,.12)", "#f5b942"] :
                ["rgba(255,255,255,.06)", "rgba(255,255,255,.35)"];
  return (
    <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded"
          style={{ background: bg, color: col }}>
      {s}
    </span>
  );
}

const TR_BORDER: React.CSSProperties = { borderBottom: "1px solid rgba(255,255,255,0.04)" };

function TH({ children }: { children: ReactNode }) {
  return (
    <th className="px-4 py-2 text-left text-[11px] font-semibold mono tracking-wide"
        style={{ color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
      {children}
    </th>
  );
}

function TD({ mono, children }: { mono?: boolean; children: ReactNode }) {
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

function GaugeCard({ label, value, display, context, tone = "normal", variant = "bar", zones = true, invert = false }: {
  label: string; value?: number; display: string; context?: string; tone?: Tone;
  variant?: "bar" | "radial";
  /** Zone bands assume "higher is worse, toward a redline" - opt out for "higher is better" metrics (bar only). */
  zones?: boolean;
  /** Flip zones to "higher is better" (danger at the low end) - radial only. */
  invert?: boolean;
}) {
  const radial = variant === "radial";
  return (
    <div className="panel p-4 flex flex-col justify-between" style={{ minHeight: radial ? 180 : 108 }}>
      <div className="text-[11px] font-semibold uppercase tracking-wide muted">{label}</div>
      {radial ? (
        <div className="text-center">
          <RadialGauge value={value} display={display} tone={tone} invert={invert} />
          {context && <div className="text-xs muted -mt-1">{context}</div>}
        </div>
      ) : (
        <div>
          <div className={`text-2xl font-semibold tabular-nums${valCls(tone)}`}>{display}</div>
          {zones ? <ZoneMeterBar value={value} /> : <MeterBar value={value} tone={tone} />}
          {context && <div className="text-xs muted mt-1.5">{context}</div>}
        </div>
      )}
    </div>
  );
}

/* ── Overview tab ───────────────────────────────────────────────────────── */
function OverviewTab({
  metrics, engineMode, version, connStatus, connectedMt5, autotradingEnabled, signalEngineConnected, lastMetricsAt, isStale,
}: {
  metrics: Record<string, unknown>;
  engineMode?: string;
  version: string;
  connStatus: string;
  connectedMt5: boolean;
  autotradingEnabled: boolean | null;
  signalEngineConnected: boolean;
  lastMetricsAt: number | null;
  isStale: boolean;
}) {
  const balance      = pick(metrics, "balance", "current_balance");
  const equity       = pick(metrics, "equity");
  const dailyPnl     = pick(metrics, "daily_pnl");
  const maxDrawdown  = pick(metrics, "drawdown_pct");
  const startBal     = pick(metrics, "start_balance");
  const peakEquity   = pick(metrics, "peak_equity");
  const dailyBudget  = pick(metrics, "daily_budget");
  const budgetUsed   = pick(metrics, "daily_budget_used");
  const budgetLeft   = pick(metrics, "daily_budget_left");
  const riskPerTrade = pick(metrics, "risk_per_trade");
  const openTrades   = pick(metrics, "open_trades", "trades_open_count");
  const pendingSigs  = pick(metrics, "pending_signals");
  const riskSlots    = pick(metrics, "risk_slots");
  const dailyLossPct = pick(metrics, "daily_loss_pct");
  const signalAgeMs  = pick(metrics, "latency_market_signal_age_ms");
  const execPipeMs   = pick(metrics, "latency_execution_pipeline_ms", "latency_pipeline_ms");
  const brokerRttMs  = pick(metrics, "latency_broker_round_trip_ms");

  const budgetUsagePct =
    isN(dailyBudget) && dailyBudget > 0 && isN(budgetUsed)
      ? (budgetUsed / dailyBudget) * 100 : undefined;
  const dailyPnlPct =
    isN(startBal) && startBal !== 0 && isN(dailyPnl)
      ? (dailyPnl / startBal) * 100 : undefined;

  return (
    <div className="space-y-5">
      {isStale && <StaleBanner label="Execution engine" lastUpdatedAt={lastMetricsAt} />}

      <section>
        <div className="flex items-center justify-between gap-3 mb-2">
          <SectionHead label="Engine Health" />
          <LastUpdated at={lastMetricsAt} />
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-6 gap-2.5">
          <div className="kpi">
            <div className="kpi-label">Connection</div>
            <div className="mt-2"><StatusBadge kind={connStatus === "connected" ? "online" : connStatus === "connecting" ? "connecting" : "offline"} /></div>
          </div>
          <div className="kpi">
            <div className="kpi-label">MT5 Broker</div>
            <div className="mt-2"><StatusBadge kind={connectedMt5 ? "connected" : "disconnected"} /></div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Signal Feed</div>
            <div className="mt-2"><StatusBadge kind={signalEngineConnected ? "connected" : "disconnected"} label={signalEngineConnected ? "Connected" : "Disconnected"} /></div>
          </div>
          <div className="kpi">
            <div className="kpi-label">AutoTrading</div>
            <div className="mt-2">
              <StatusBadge
                kind={autotradingEnabled === null ? "none" : autotradingEnabled ? "connected" : "warning"}
                label={autotradingEnabled === null ? "Unknown" : autotradingEnabled ? "Enabled" : "Disabled"}
              />
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Trading State</div>
            <div className="mt-2"><StatusBadge kind={engineMode === "PAUSED" ? "paused" : "active"} label={engineMode || "-"} /></div>
          </div>
          <StatCard label="Version" value={version} />
        </div>
      </section>

      <section>
        <SectionHead label="Account Snapshot" />
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          <div className="kpi">
            <div className="kpi-label">Balance</div>
            <div className="kpi-value">{money(balance)}</div>
            {isN(startBal) && <div className="kpi-detail">Start {money(startBal)}</div>}
          </div>
          <div className="kpi">
            <div className="kpi-label">Equity</div>
            <div className="kpi-value">{money(equity)}</div>
            {isN(peakEquity) && <div className="kpi-detail">Peak {money(peakEquity)}</div>}
          </div>
          <div className={`kpi${kpiCls(signedTone(dailyPnl))}`}>
            <div className="kpi-label">Daily P&amp;L</div>
            <div className={`kpi-value${valCls(signedTone(dailyPnl))}`}>{money(dailyPnl, true)}</div>
            <div className="kpi-detail">{pct(dailyPnlPct, true)}</div>
          </div>
          <div className={`kpi${isN(maxDrawdown) && maxDrawdown > 0 ? " kpi-warn" : ""}`}>
            <div className="kpi-label">Max Drawdown</div>
            <div className={`kpi-value${isN(maxDrawdown) && maxDrawdown > 0 ? " warn" : ""}`}>
              {pct(maxDrawdown)}
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionHead label="Risk State" />
        <div className="grid lg:grid-cols-[1fr_260px] gap-2.5">
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
            <StatCard label="Daily Budget"   value={money(dailyBudget)} />
            <StatCard label="Budget Used"    value={money(budgetUsed)}  tone={usageTone(budgetUsagePct)} />
            <StatCard label="Budget Left"    value={money(budgetLeft)}  tone={isN(budgetLeft) && budgetLeft > 0 ? "good" : "normal"} />
            <StatCard label="Risk Per Trade" value={money(riskPerTrade)} />
          </div>
          <div className="panel p-4 flex flex-col justify-between">
            <div className="text-xs muted">Daily Budget Usage</div>
            <div>
              <div className={`text-2xl font-semibold tabular-nums${valCls(usageTone(budgetUsagePct))}`}>
                {pct(budgetUsagePct)}
              </div>
              <MeterBar value={budgetUsagePct} tone={usageTone(budgetUsagePct)} />
              <div className="text-xs muted mt-1.5">
                {isN(budgetUsed) ? `${money(budgetUsed)} of ${money(dailyBudget)} used` : "No budget data"}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionHead label="Current Exposure" />
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          <StatCard label="Open Positions"  value={cnt(openTrades)}   detail={openTrades === 0 ? "No open positions" : undefined} />
          <StatCard label="Pending Signals" value={cnt(pendingSigs)} />
          <StatCard label="Risk Slots"      value={cnt(riskSlots)} />
          <StatCard label="Daily Loss"      value={pct(dailyLossPct)} tone={isN(dailyLossPct) && dailyLossPct > 0 ? "warn" : "normal"} />
        </div>
      </section>

      <section>
        <SectionHead label="Latency Snapshot" />
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          <StatCard label="Signal Age"         value={msf(signalAgeMs)}  tone={latTone(signalAgeMs)} />
          <StatCard label="Execution Pipeline" value={msf(execPipeMs)}   tone={latTone(execPipeMs)} />
          <StatCard label="Broker RTT"         value={msf(brokerRttMs)}  tone={latTone(brokerRttMs)} />
          <StatCard label="Engine Mode"        value={engineMode || "-"} />
        </div>
      </section>
    </div>
  );
}

/* ── Positions tab ──────────────────────────────────────────────────────── */
function PnlText({ value, suffix = "" }: { value: number; suffix?: string }) {
  return (
    <span className="mono" style={{ color: value >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
      {value >= 0 ? "+" : ""}{value.toFixed(2)}{suffix}
    </span>
  );
}

function posPnlPct(pos: NPos): number {
  return pos.openPrice > 0 ? (pos.profit / (pos.openPrice * pos.volume)) * 100 : 0;
}

const POSITION_COLUMNS: ColumnDef<NPos>[] = [
  { key: "ticket",   label: "Ticket",   render: p => <span className="muted mono">{String(p.ticket)}</span> },
  { key: "symbol",   label: "Symbol",   render: p => <span className="font-bold text-white mono">{p.symbol}</span> },
  { key: "side",     label: "Side",     render: p => <DirBadge dir={p.direction} /> },
  { key: "size",     label: "Size",     render: p => <span className="mono">{p.volume}</span> },
  { key: "entry",    label: "Entry",    render: p => <span className="mono">{fmtPrice(p.openPrice)}</span> },
  { key: "sl",       label: "SL",       render: p => <span className="muted mono">{fmtPrice(p.stopLoss)}</span> },
  { key: "tp",       label: "TP",       render: p => <span className="muted mono">{fmtPrice(p.takeProfit)}</span> },
  { key: "pnl",      label: "P&L",      render: p => <PnlText value={p.profit} /> },
  { key: "pnlPct",   label: "P&L %",    render: p => <PnlText value={posPnlPct(p)} suffix="%" /> },
  { key: "strategy", label: "Strategy", render: p => <span className="muted">{p.strategy ?? "-"}</span> },
];

function PositionsTab({ positions }: { positions: NPos[] }) {
  if (positions.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="No open positions"
        description="Positions appear here when the engine opens trades."
      />
    );
  }

  return (
    <SurfaceSection
      icon={Layers}
      title="Open Trades"
      subtitle={`${positions.length} position${positions.length !== 1 ? "s" : ""}`}
      badge={<span className="badge badge-green">{positions.length}</span>}
      flush
    >
      <DataTable
        columns={POSITION_COLUMNS}
        rows={positions}
        rowKey={(p, i) => `${p.ticket}_${i}`}
        emptyMessage="No open positions."
        renderCard={p => (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold mono text-sm" style={{ color: "var(--text)" }}>{p.symbol}</span>
              <span className="flex items-center gap-2 shrink-0">
                <DirBadge dir={p.direction} />
                <PnlText value={p.profit} />
              </span>
            </div>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>
              {p.strategy ?? "-"} · vol {p.volume}
              <span className="ml-2"><PnlText value={posPnlPct(p)} suffix="%" /></span>
            </div>
            <div className="text-[11.5px] font-mono flex items-center gap-2 flex-wrap">
              <span style={{ color: "var(--text-soft)" }}>{fmtPrice(p.openPrice)}</span>
              <span style={{ color: "var(--muted)" }}>SL {fmtPrice(p.stopLoss)}</span>
              <span style={{ color: "var(--muted)" }}>TP {fmtPrice(p.takeProfit)}</span>
            </div>
          </div>
        )}
      />
    </SurfaceSection>
  );
}

/* ── Signals tab ────────────────────────────────────────────────────────── */
const SIGNAL_COLUMNS: ColumnDef<NSig>[] = [
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
  { key: "entry",    label: "Entry",    render: s => <span className="mono">{fmtPrice(s.entry)}</span> },
  { key: "sl",       label: "SL",       render: s => <span className="muted mono">{fmtPrice(s.stopLoss)}</span> },
  { key: "tp",       label: "TP",       render: s => <span className="muted mono">{fmtPrice(s.takeProfit)}</span> },
  { key: "setup",    label: "Setup",    render: s => <span className="muted block max-w-[200px] truncate">{s.setup ?? "-"}</span> },
  { key: "status",   label: "Status",   render: s => <SigBadge status={s.status} /> },
];

function SignalsTab({ signals }: { signals: NSig[] }) {
  if (signals.length === 0) {
    return (
      <EmptyState
        icon={Radio}
        title="No signals yet"
        description="Signal events appear here when received by the engine."
      />
    );
  }

  return (
    <SurfaceSection
      icon={Radio}
      title="Recent Signals"
      subtitle="Signals received by this engine"
      badge={<span className="badge badge-green">{signals.length}</span>}
      flush
    >
      <DataTable
        columns={SIGNAL_COLUMNS}
        rows={signals}
        rowKey={(s, i) => `${s.id}_${i}`}
        emptyMessage="No signals yet."
        renderCard={s => (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold mono text-sm" style={{ color: "var(--text)" }}>{s.symbol}</span>
              <span className="flex items-center gap-1.5 shrink-0">
                <DirBadge dir={s.direction} />
                <SigBadge status={s.status} />
              </span>
            </div>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>
              {s.strategy} · {s.timeframe}
              {s.confidence !== undefined && <> · {(s.confidence * 100).toFixed(0)}%</>}
              <span className="ml-2 font-mono">{fmtTs(s.timestamp)}</span>
            </div>
            <div className="text-[11.5px] font-mono flex items-center gap-2 flex-wrap">
              <span style={{ color: "var(--text-soft)" }}>{fmtPrice(s.entry)}</span>
              <span style={{ color: "var(--muted)" }}>SL {fmtPrice(s.stopLoss)}</span>
              <span style={{ color: "var(--muted)" }}>TP {fmtPrice(s.takeProfit)}</span>
            </div>
          </div>
        )}
      />
    </SurfaceSection>
  );
}

/* ── Metrics tab ────────────────────────────────────────────────────────── */
function MetricsTab({ metrics }: { metrics: Record<string, unknown> }) {
  const n = (...keys: string[]) => pick(metrics, ...keys);

  const budgetUsed     = n("daily_budget_used");
  const dailyBudget    = n("daily_budget");
  const budgetUsagePct = isN(dailyBudget) && dailyBudget > 0 && isN(budgetUsed)
    ? (budgetUsed / dailyBudget) * 100 : undefined;
  const dailyLossPct      = n("daily_loss_pct");
  const dailyLossLimitPct = n("daily_loss_limit_percent");
  const marginLevel       = n("margin_level");
  const winRate           = n("win_rate");
  const openTrades        = n("open_trades", "trades_open_count");
  const riskSlots         = n("risk_slots");
  const riskApproved      = n("risk_approved");
  const riskRejected      = n("risk_rejected");
  const rejPressure       = isN(riskApproved) && isN(riskRejected)
    ? (riskRejected / Math.max(riskApproved + riskRejected, 1)) * 100 : undefined;
  const slotUsagePct      = isN(openTrades) && isN(riskSlots) && riskSlots > 0
    ? (openTrades / riskSlots) * 100 : undefined;
  const entryDriftPct     = n("entry_drift_pct_of_risk");
  const entryDriftMaxPct  = n("entry_drift_max_pct_of_risk");
  const entryDriftUsagePct = isN(entryDriftPct) && isN(entryDriftMaxPct) && entryDriftMaxPct > 0
    ? (entryDriftPct / entryDriftMaxPct) * 100 : undefined;

  const rawCounters = metrics.raw_counters as Record<string, number> | undefined;
  const rawGauges   = metrics.raw_gauges   as Record<string, number> | undefined;

  return (
    <div className="space-y-5">
      {/* Top gauge cards */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <GaugeCard
          label="Daily Budget Usage"
          value={budgetUsagePct}
          display={pct(budgetUsagePct)}
          context={`${money(budgetUsed)} used`}
          tone={usageTone(budgetUsagePct)}
          variant="radial"
        />
        <GaugeCard
          label="Daily Loss"
          value={isN(dailyLossPct) ? dailyLossPct : undefined}
          display={pct(dailyLossPct)}
          context={`Limit ${pct(dailyLossLimitPct)}`}
          tone={usageTone(dailyLossPct)}
          variant="radial"
        />
        {/* Margin Level and Win Rate are "higher is better" - invert flips the
            zone bands so danger sits at the low end instead of the high end. */}
        <GaugeCard
          label="Margin Level"
          value={isN(marginLevel) ? Math.min(marginLevel, 100) : undefined}
          display={pct(marginLevel)}
          context="Broker account margin"
          tone={isN(marginLevel) && marginLevel < 150 ? "warn" : isN(marginLevel) ? "good" : "normal"}
          variant="radial"
          invert
        />
        <GaugeCard
          label="Win Rate"
          value={isN(winRate) ? winRate : undefined}
          display={pct(winRate)}
          context="Closed trade hit rate"
          tone={isN(winRate) && winRate >= 50 ? "good" : "normal"}
          variant="radial"
          invert
        />
      </div>

      {/* Account */}
      <section>
        <SectionHead label="Account" />
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
          <StatCard label="Balance"      value={money(n("balance", "current_balance"))} />
          <StatCard label="Equity"       value={money(n("equity"))} />
          <StatCard label="Daily P&L"    value={money(n("daily_pnl"), true)} tone={signedTone(n("daily_pnl"))} />
          <StatCard label="Free Margin"  value={money(n("free_margin"))} />
          <StatCard label="Margin"       value={money(n("margin"))} />
          <StatCard label="Margin Level" value={pct(marginLevel)} />
          <StatCard label="Peak Equity"  value={money(n("peak_equity"))} />
          <StatCard label="Max Drawdown" value={pct(n("drawdown_pct"))}
            tone={isN(n("drawdown_pct")) && (n("drawdown_pct") as number) > 0 ? "warn" : "normal"} />
        </div>
      </section>

      {/* Risk */}
      <section>
        <SectionHead label="Risk" />
        <div className="grid lg:grid-cols-[1fr_300px] gap-3">
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            <StatCard label="Daily Budget"          value={money(dailyBudget)} />
            <StatCard label="Budget Used"           value={money(budgetUsed)} tone={usageTone(budgetUsagePct)} />
            <StatCard label="Budget Left"           value={money(n("daily_budget_left"))}
              tone={isN(n("daily_budget_left")) && (n("daily_budget_left") as number) > 0 ? "good" : "normal"} />
            <StatCard label="Risk Per Trade"        value={money(n("risk_per_trade"))} />
            <StatCard label="Daily Loss %"          value={pct(dailyLossPct)} tone={usageTone(dailyLossPct)} />
            <StatCard label="Daily Loss Limit %"    value={pct(dailyLossLimitPct)} />
            <StatCard label="Max Losing Streak"     value={cnt(n("max_losing_streak"))} />
            <StatCard label="Current Losing Streak" value={cnt(n("current_losing_streak"))} />
            <StatCard label="Risk Slots"            value={cnt(riskSlots)} />
          </div>
          <div className="space-y-2.5">
            {[
              { label: "Budget Used",        v: budgetUsagePct, display: pct(budgetUsagePct), tone: usageTone(budgetUsagePct) },
              { label: "Rejection Pressure", v: rejPressure,   display: pct(rejPressure),   tone: usageTone(rejPressure) },
              { label: "Slot Usage",         v: slotUsagePct,  display: `${cnt(openTrades)} / ${cnt(riskSlots)}`, tone: "normal" as Tone },
            ].map(item => (
              <div key={item.label} className="panel p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] muted">{item.label}</span>
                  <span className={`text-xs font-mono${valCls(item.tone)}`}>{item.display}</span>
                </div>
                <MeterBar value={item.v} tone={item.tone} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid xl:grid-cols-2 gap-5">
        {/* Execution flow */}
        <section>
          <SectionHead label="Execution Flow" />
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard label="Open Trades"      value={cnt(openTrades)} />
            <StatCard label="Trades Today"     value={cnt(n("total_trades_today"))} />
            <StatCard label="Orders Opened"    value={cnt(n("orders_opened"))} />
            <StatCard label="Orders Filled"    value={cnt(n("orders_filled"))} tone="good" />
            <StatCard label="Orders Rejected"  value={cnt(n("orders_rejected"))}
              tone={isN(n("orders_rejected")) && (n("orders_rejected") as number) > 0 ? "warn" : "normal"} />
            <StatCard label="Orders Retried"   value={cnt(n("orders_retried"))} />
            <StatCard label="Partial Fills"    value={cnt(n("orders_partial_fills"))} />
            <StatCard label="Slippage Reject"  value={cnt(n("orders_slippage_rejected"))}
              tone={isN(n("orders_slippage_rejected")) && (n("orders_slippage_rejected") as number) > 0 ? "warn" : "normal"} />
            <StatCard label="Emergency Closes" value={cnt(n("orders_emergency_closes"))}
              tone={isN(n("orders_emergency_closes")) && (n("orders_emergency_closes") as number) > 0 ? "danger" : "normal"} />
            <StatCard label="Margin Reduced"   value={cnt(n("orders_margin_reduced"))} />
          </div>
        </section>

        {/* Signal flow */}
        <section>
          <SectionHead label="Signal Flow" />
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard label="Signals Received"   value={cnt(n("signals_received"))} />
            <StatCard label="Signals Triggered"  value={cnt(n("signals_triggered"))} />
            <StatCard label="Validation Fails"   value={cnt(n("signals_validation_failures"))}
              tone={isN(n("signals_validation_failures")) && (n("signals_validation_failures") as number) > 0 ? "warn" : "normal"} />
            <StatCard label="Parse Errors"       value={cnt(n("signals_parse_errors"))}
              tone={isN(n("signals_parse_errors")) && (n("signals_parse_errors") as number) > 0 ? "danger" : "normal"} />
            <StatCard label="Deserialise Errors" value={cnt(n("signals_deserialise_errors"))}
              tone={isN(n("signals_deserialise_errors")) && (n("signals_deserialise_errors") as number) > 0 ? "danger" : "normal"} />
            <StatCard label="Duplicates Ignored" value={cnt(n("signal_duplicates_ignored"))} />
            <StatCard label="Risk Approved"      value={cnt(riskApproved)} tone="good" />
            <StatCard label="Risk Rejected"      value={cnt(riskRejected)}
              tone={isN(riskRejected) && riskRejected > 0 ? "warn" : "normal"} />
          </div>
        </section>
      </div>

      <div className="grid xl:grid-cols-[380px_1fr] gap-5">
        {/* Latency */}
        <section>
          <SectionHead label="Latency" />
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard label="Signal-to-Trade"   value={msf(n("latency_signal_to_trade_ms", "signal_to_trade_ms"))}
              tone={latTone(n("latency_signal_to_trade_ms", "signal_to_trade_ms"))} />
            <StatCard label="Market Signal Age" value={msf(n("latency_market_signal_age_ms"))}
              tone={latTone(n("latency_market_signal_age_ms"))} />
            <StatCard label="Emit-to-Receive"   value={msf(n("latency_emit_to_receive_ms"))}
              tone={latTone(n("latency_emit_to_receive_ms"))} />
            <StatCard label="Recv-to-Execute"   value={msf(n("latency_receive_to_execute_ms"))}
              tone={latTone(n("latency_receive_to_execute_ms"))} />
            <StatCard label="Exec Pipeline"     value={msf(n("latency_execution_pipeline_ms", "latency_pipeline_ms"))}
              tone={latTone(n("latency_execution_pipeline_ms", "latency_pipeline_ms"))} />
            <StatCard label="Broker RTT"        value={msf(n("latency_broker_round_trip_ms"))}
              tone={latTone(n("latency_broker_round_trip_ms"))} />
          </div>
        </section>

        {/* Trade outcomes */}
        <section>
          <SectionHead label="Trade Outcomes" />
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-2.5">
            <StatCard label="Winning Trades" value={cnt(n("winning_trades"))} tone="good" />
            <StatCard label="Losing Trades"  value={cnt(n("losing_trades"))}
              tone={isN(n("losing_trades")) && (n("losing_trades") as number) > 0 ? "danger" : "normal"} />
            <StatCard label="Win Rate"       value={pct(winRate)} />
            <StatCard label="Profit Factor"  value={ratio(n("profit_factor"))} />
            <StatCard label="Average RRR"    value={ratio(n("average_rrr"))} />
            <StatCard label="Executed RRR"   value={ratio(n("executed_rrr"))} />
            <StatCard label="TP1 Hits"       value={cnt(n("trades_tp1_hit"))} />
            <StatCard label="TP2 Hits"       value={cnt(n("trades_tp2_hit"))} />
            <StatCard label="SL Hits"        value={cnt(n("trades_sl_hit"))} />
            <StatCard label="Trades Opened"  value={cnt(n("trades_opened"))} />
            <StatCard label="Trades Closed"  value={cnt(n("trades_closed"))} />
          </div>
        </section>
      </div>

      {/* Execution quality */}
      <section>
        <SectionHead label="Execution Quality" />
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <GaugeCard
            label="Entry Drift"
            value={entryDriftUsagePct}
            display={pct(entryDriftPct)}
            context={`Of signal risk, vs ${pct(entryDriftMaxPct)} reference`}
            tone={usageTone(entryDriftUsagePct)}
          />
        </div>
      </section>

      {/* Raw counters / gauges - only when populated */}
      {((rawCounters && Object.keys(rawCounters).length > 0) ||
        (rawGauges   && Object.keys(rawGauges).length   > 0)) && (
        <div className="grid xl:grid-cols-2 gap-4">
          {rawCounters && Object.keys(rawCounters).length > 0 && (
            <details className="panel overflow-hidden">
              <summary className="panel-head cursor-pointer list-none">
                <div className="text-sm font-semibold">Raw Counters</div>
                <span className="badge badge-muted">{Object.keys(rawCounters).length}</span>
              </summary>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr><TH>Metric</TH><TH>Value</TH></tr></thead>
                  <tbody>
                    {Object.entries(rawCounters).map(([k, v]) => (
                      <tr key={k} style={TR_BORDER}>
                        <TD mono><span className="muted">{k}</span></TD>
                        <TD mono>{v.toLocaleString()}</TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
          {rawGauges && Object.keys(rawGauges).length > 0 && (
            <details className="panel overflow-hidden">
              <summary className="panel-head cursor-pointer list-none">
                <div className="text-sm font-semibold">Raw Gauges</div>
                <span className="badge badge-muted">{Object.keys(rawGauges).length}</span>
              </summary>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr><TH>Gauge</TH><TH>Value</TH></tr></thead>
                  <tbody>
                    {Object.entries(rawGauges).map(([k, v]) => (
                      <tr key={k} style={TR_BORDER}>
                        <TD mono><span className="muted">{k}</span></TD>
                        <TD mono>{typeof v === "number" ? v.toFixed(4) : String(v)}</TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Configuration tab ──────────────────────────────────────────────────── */
function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5"
         style={{ borderBottom: "1px solid rgba(255,255,255,.05)" }}>
      <span className="text-xs muted shrink-0">{label}</span>
      <span className="font-mono text-xs text-right min-w-0 break-all" style={{ color: "var(--text-soft)" }}>{value}</span>
    </div>
  );
}

function cfgValue(v: unknown): string {
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return v.join(", ");
  if (v && typeof v === "object") return JSON.stringify(v);
  return String(v ?? "-");
}

function ConfigurationTab({ config, version }: {
  config: Record<string, unknown> | null | undefined;
  version: string;
}) {
  if (!config) {
    return (
      <EmptyState
        icon={Settings2}
        title="Config not available"
        description="The execution engine has not reported its configuration in this snapshot."
      />
    );
  }

  const risk = (config.risk ?? {}) as Record<string, unknown>;
  const execCfg = (config.execution ?? {}) as Record<string, unknown>;
  const mt5 = (config.mt5 ?? {}) as Record<string, unknown>;
  const engineCfg = (config.engine ?? {}) as Record<string, unknown>;

  return (
    <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
      <div className="panel overflow-hidden">
        <div className="panel-head"><div className="text-sm font-semibold">Enabled Symbols</div></div>
        <div className="panel-body">
          <ConfigRow label="Environment" value={String(config.mode ?? "-").toUpperCase()} />
          {Array.isArray(config.symbols) && (
            <ConfigRow label="Symbols" value={(config.symbols as string[]).join(", ")} />
          )}
          <ConfigRow label="Signal Engine WS" value={String(config.signal_ws_url ?? "-")} />
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-head"><div className="text-sm font-semibold">Risk Settings</div></div>
        <div className="panel-body">
          <ConfigRow label="Max Losing Streak" value={cfgValue(risk.max_losing_streak)} />
          <ConfigRow label="Max Daily Loss %" value={cfgValue(risk.max_daily_loss_percent)} />
          <ConfigRow label="Max Exposure / Symbol" value={cfgValue(risk.max_exposure_per_symbol)} />
          <ConfigRow label="Min RR Ratio" value={cfgValue(risk.min_rr_ratio)} />
          <ConfigRow label="Lot Size (min/max)" value={`${cfgValue(risk.min_lot_size)} / ${cfgValue(risk.max_lot_size)}`} />
          <ConfigRow label="SL Ratio Threshold" value={cfgValue(risk.sl_ratio_threshold)} />
          <ConfigRow label="No Hedging" value={cfgValue(risk.no_hedging)} />
          <ConfigRow label="Max Profit Drawdown %" value={cfgValue(risk.max_profit_drawdown_percent)} />
          <ConfigRow label="Rolling Window" value={cfgValue(risk.rolling_window_size)} />
          <ConfigRow label="Rolling Drawdown %" value={cfgValue(risk.rolling_drawdown_pct)} />
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-head"><div className="text-sm font-semibold">Feature Flags</div></div>
        <div className="panel-body">
          {[
            ["Equity Throttle", (risk.equity_throttle as Record<string, unknown> | undefined)?.enabled],
            ["Cluster Risk", (risk.cluster_risk as Record<string, unknown> | undefined)?.enabled],
            ["No Hedging", risk.no_hedging],
            ["Close on Slippage Exceed", execCfg.close_on_slippage_exceed],
            ["Adjust Levels on Slippage", execCfg.adjust_levels_on_slippage],
            ["Move SL to BE on TP1", execCfg.move_sl_to_be_on_tp1],
          ].map(([label, value]) => (
            <div key={label as string} className="flex items-center justify-between py-1.5">
              <span className="text-xs muted">{label as string}</span>
              <StatusBadge kind={value ? "active" : "idle"} label={value ? "Enabled" : "Disabled"} />
            </div>
          ))}
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-head"><div className="text-sm font-semibold">Execution Settings</div></div>
        <div className="panel-body">
          <ConfigRow label="TP1 Trigger %" value={cfgValue(execCfg.tp1_trigger_pct)} />
          <ConfigRow label="TP1 Percentage" value={cfgValue(execCfg.tp1_percentage)} />
          <ConfigRow label="Spread Risk Mult" value={cfgValue(execCfg.spread_risk_multiplier)} />
          <ConfigRow label="Order Retry Count" value={cfgValue(execCfg.order_retry_count)} />
          <ConfigRow label="Order Retry Delay (s)" value={cfgValue(execCfg.order_retry_delay_sec)} />
          <ConfigRow label="Max Entry Slippage %" value={cfgValue(execCfg.max_entry_slippage_pct_of_stop)} />
          <ConfigRow label="Max Signal Age (ms)" value={cfgValue(execCfg.max_signal_age_ms)} />
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-head"><div className="text-sm font-semibold">Broker / MT5</div></div>
        <div className="panel-body">
          <ConfigRow label="Login" value={cfgValue(mt5.login)} />
          <ConfigRow label="Server" value={cfgValue(mt5.server)} />
          <ConfigRow label="Magic #" value={cfgValue(mt5.magic)} />
          <ConfigRow label="Slippage" value={cfgValue(mt5.slippage)} />
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-head"><div className="text-sm font-semibold">Engine / WebSocket Settings</div></div>
        <div className="panel-body">
          <ConfigRow label="Timezone" value={cfgValue(engineCfg.timezone)} />
          <ConfigRow label="Position Poll Interval (s)" value={cfgValue(engineCfg.position_poll_interval)} />
          <ConfigRow label="Dashboard Bridge Port" value={cfgValue(engineCfg.monitoring_port)} />
          <ConfigRow label="Engine Version" value={version} />
        </div>
      </div>
    </div>
  );
}

/* ── Performance tab ────────────────────────────────────────────────────── */
function PerformanceTab({ metrics, system }: {
  metrics: Record<string, unknown>;
  system:  Record<string, unknown>;
}) {
  const n = (...keys: string[]) => pick(metrics, ...keys);
  return (
    <div className="space-y-5">
      <section>
        <SectionHead label="Latency" />
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-2.5">
          <StatCard label="Signal-to-Trade"   value={msf(n("latency_signal_to_trade_ms", "signal_to_trade_ms"))}
            tone={latTone(n("latency_signal_to_trade_ms", "signal_to_trade_ms"))} />
          <StatCard label="Market Signal Age" value={msf(n("latency_market_signal_age_ms"))}
            tone={latTone(n("latency_market_signal_age_ms"))} />
          <StatCard label="Emit-to-Receive"   value={msf(n("latency_emit_to_receive_ms"))}
            tone={latTone(n("latency_emit_to_receive_ms"))} />
          <StatCard label="Recv-to-Execute"   value={msf(n("latency_receive_to_execute_ms"))}
            tone={latTone(n("latency_receive_to_execute_ms"))} />
          <StatCard label="Exec Pipeline"     value={msf(n("latency_execution_pipeline_ms", "latency_pipeline_ms"))}
            tone={latTone(n("latency_execution_pipeline_ms", "latency_pipeline_ms"))} />
          <StatCard label="Broker RTT"        value={msf(n("latency_broker_round_trip_ms"))}
            tone={latTone(n("latency_broker_round_trip_ms"))} />
        </div>
      </section>

      <section>
        <SectionHead label="Resource Usage" />
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          <StatCard label="Memory" value={isN(system.memory_mb ?? n("memory_mb")) ? `${Number(system.memory_mb ?? n("memory_mb")).toFixed(0)} MB` : "-"} />
          <StatCard label="CPU" value={isN(system.cpu_percent ?? n("cpu_percent")) ? `${Number(system.cpu_percent ?? n("cpu_percent")).toFixed(1)}%` : "n/a"} />
          <StatCard label="Uptime" value={fmtDuration(n("uptime_sec") ?? pick(system, "uptime_sec"))} />
          <StatCard label="Connected Clients" value={cnt(n("connected_clients") ?? pick(system, "connected_clients"))} />
        </div>
      </section>
    </div>
  );
}

/* ── Guards tab ─────────────────────────────────────────────────────────── */
function GuardsTab({ guards }: { guards: RGuard[] }) {
  if (guards.length === 0) {
    return (
      <EmptyState
        icon={ShieldOff}
        title="No risk guards"
        description="Risk guard data is not present in the current snapshot."
      />
    );
  }

  /* annotate each guard with computed fields */
  const annotated = guards.map(g => {
    const pct      = g.threshold > 0 ? (g.current_value / g.threshold) * 100 : undefined;
    const isActive = g.status.toUpperCase() === "ACTIVE";
    const isPaused = g.status.toUpperCase() === "PAUSED";
    const tone: Tone = !isActive ? "normal"
      : isN(pct) && pct >= 90 ? "danger"
      : isN(pct) && pct >= 70 ? "warn"
      : "good";
    const triggered = isActive && isN(pct) && pct >= 100;
    return { ...g, pct, isActive, isPaused, tone, triggered };
  });

  /* sort: danger → warn → good → inactive */
  const ORDER: Record<Tone, number> = { danger: 0, warn: 1, good: 2, normal: 3 };
  const sorted = [...annotated].sort((a, b) => ORDER[a.tone] - ORDER[b.tone]);

  const dangerCount  = sorted.filter(g => g.tone === "danger").length;
  const warnCount    = sorted.filter(g => g.tone === "warn").length;
  const healthyCount = sorted.filter(g => g.tone === "good").length;
  const inactiveCount = sorted.filter(g => !g.isActive).length;

  return (
    <div className="space-y-3">

      {/* ── Summary KPI row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="kpi">
          <div className="kpi-label">Total guards</div>
          <div className="kpi-value">{guards.length}</div>
          {inactiveCount > 0 && (
            <div className="kpi-detail muted">{inactiveCount} inactive</div>
          )}
        </div>
        <div className={`kpi${dangerCount > 0 ? " kpi-danger" : ""}`}>
          <div className="kpi-label">Danger</div>
          <div className={`kpi-value${dangerCount > 0 ? " danger" : ""}`}>{dangerCount}</div>
          <div className="kpi-detail muted">≥ 90% used</div>
        </div>
        <div className={`kpi${warnCount > 0 ? " kpi-warn" : ""}`}>
          <div className="kpi-label">Warning</div>
          <div className={`kpi-value${warnCount > 0 ? " warn" : ""}`}>{warnCount}</div>
          <div className="kpi-detail muted">70–90% used</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Healthy</div>
          <div className={`kpi-value${healthyCount > 0 ? " good" : ""}`}>{healthyCount}</div>
          <div className="kpi-detail muted">&lt; 70% used</div>
        </div>
      </div>

      {/* ── Guard cards ── */}
      {sorted.map(guard => {
        const accentColor =
          guard.tone === "danger" ? "var(--danger)"  :
          guard.tone === "warn"   ? "var(--warning)" :
          guard.tone === "good"   ? "var(--success)" :
          "rgba(255,255,255,.10)";

        const dotClass =
          guard.tone === "danger" ? "dot dot-dead" :
          guard.tone === "warn"   ? "dot dot-warn" :
          guard.tone === "good"   ? "dot dot-live pulse" :
          "dot dot-muted";

        const remaining = isN(guard.pct) && guard.threshold > 0
          ? guard.threshold - guard.current_value
          : undefined;

        return (
          <div
            key={guard.id}
            className="panel overflow-hidden"
            style={{ borderLeft: `3px solid ${accentColor}` }}
          >
            {/* name + status badges + pct */}
            <div className="px-4 pt-4 pb-0 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={dotClass} style={{ width: 8, height: 8 }} />
                  <span className="text-sm font-semibold">{guard.name}</span>
                  {guard.triggered && (
                    <span className="badge badge-red" style={{ fontSize: 10 }}>Triggered</span>
                  )}
                </div>
                {guard.description && (
                  <p className="text-xs muted mt-1 leading-5 pl-[18px]">{guard.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className={`badge ${guard.isActive ? "badge-green" : guard.isPaused ? "badge-warn" : "badge-muted"}`}>
                  {guard.status}
                </span>
                {isN(guard.pct) && (
                  <span className={`text-lg font-semibold tabular-nums mono leading-none${valCls(guard.tone)}`}>
                    {guard.pct.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>

            {/* meter bar */}
            <div className="px-4 pt-3">
              <MeterBar value={guard.pct} tone={guard.tone} />
            </div>

            {/* current / limit / remaining */}
            <div className="px-4 pt-2.5 pb-4 flex items-center gap-5 text-xs flex-wrap">
              <div>
                <span className="muted">Current </span>
                <span className={`mono font-semibold${valCls(guard.tone)}`}>
                  {guard.current_value} {guard.unit}
                </span>
              </div>
              <div>
                <span className="muted">Limit </span>
                <span className="mono">{guard.threshold} {guard.unit}</span>
              </div>
              {remaining !== undefined && (
                <div className="ml-auto">
                  <span className="muted">Remaining </span>
                  <span className="mono">
                    {remaining % 1 === 0 ? remaining : remaining.toFixed(2)} {guard.unit}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Event tabs (shared EventFeed) ──────────────────────────────────────── */
function eventTone(type: string): FeedTone {
  if (type === "parity.warning" || type === "signal.filtered" || type === "position.partial_tp") return "warning";
  if (REJECTION_EVENT_TYPES.has(type)) return "danger";
  if (type === "trade.closed" || type === "trade.sl_hit") return "danger";
  if (ACTIVITY_EVENT_TYPES.has(type)) return "success";
  return "neutral";
}

function toFeedEvents(items: EventEntry[]): FeedEvent[] {
  return items.map(ev => ({
    id: ev.id,
    type: ev.event_type,
    time: fmtTs(ev.ts),
    summary: ev.summary || String(ev.data.reason ?? ev.data.message ?? "-"),
    tone: eventTone(ev.event_type),
    details: ev.data,
  }));
}

function EventTab({
  items, title, subtitle, emptyIcon, emptyTitle, emptyBody, dangerBadge,
}: {
  items: EventEntry[];
  title: string;
  subtitle: string;
  emptyIcon?: LucideIcon;
  emptyTitle: string;
  emptyBody: string;
  dangerBadge?: boolean;
}) {
  if (!items.length) {
    return (
      <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyBody} />
    );
  }
  return (
    <SurfaceSection
      icon={emptyIcon}
      title={title}
      subtitle={subtitle}
      badge={<span className={`badge ${dangerBadge ? "badge-red" : "badge-muted"}`}>{items.length}</span>}
      flush
    >
      <EventFeed events={toFeedEvents(items)} maxHeight={560} />
    </SurfaceSection>
  );
}

function RejectionsTab({ items }: { items: EventEntry[] }) {
  return (
    <EventTab
      items={items}
      title="Rejections"
      subtitle={`${items.length} rejection${items.length !== 1 ? "s" : ""} accumulated - click a row for details`}
      emptyIcon={ShieldOff}
      emptyTitle="No rejections"
      emptyBody="Strategy and risk rejections will appear here as events arrive from the engine."
      dangerBadge
    />
  );
}

function ActivityTab({ items }: { items: EventEntry[] }) {
  return (
    <EventTab
      items={items}
      title="Activity"
      subtitle={`${items.length} event${items.length !== 1 ? "s" : ""} accumulated - click a row for details`}
      emptyIcon={ActivityIcon}
      emptyTitle="No activity yet"
      emptyBody="Order fills, trade opens / closes, and TP / SL hits will appear here."
    />
  );
}

function EventsTab({ items }: { items: EventEntry[] }) {
  return (
    <EventTab
      items={items}
      title="Recent Events"
      subtitle={`${items.length} event${items.length !== 1 ? "s" : ""} (max 500)`}
      emptyIcon={ActivityIcon}
      emptyTitle="No events yet"
      emptyBody="All execution events will be logged here in real time."
    />
  );
}

/* ── Logs tab (raw text log lines from the execution engine's UIBridge) ─── */
interface LogLine { ts: number; level: string; name: string; msg: string }

function LogsTab({ lines }: { lines: LogLine[] }) {
  const [query, setQuery] = useState("");

  if (!lines.length) {
    return (
      <EmptyState
        icon={FileText}
        title="No log lines"
        description="Log lines captured by the execution engine will appear here (most recent 50)."
      />
    );
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? lines.filter(l => l.msg.toLowerCase().includes(q) || l.name.toLowerCase().includes(q) || l.level.toLowerCase().includes(q))
    : lines;

  return (
    <SurfaceSection
      icon={FileText}
      title="Engine Logs"
      subtitle={`${lines.length} line${lines.length !== 1 ? "s" : ""} (most recent 50)`}
      badge={<span className="badge badge-muted">{lines.length}</span>}
      flush
    >
      <div className="px-4 py-2.5" style={{ borderBottom: "1px solid var(--line-soft)" }}>
        <label className="search-input">
          <Search size={13} strokeWidth={2} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filter by logger, level, or message…"
          />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-xs">
          <thead>
            <tr>{["Time", "Level", "Logger", "Message"].map(c => <TH key={c}>{c}</TH>)}</tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-xs muted text-center">No log lines match &quot;{query}&quot;.</td></tr>
            )}
            {filtered.map((l, i) => (
              <tr key={i} style={TR_BORDER}>
                <TD mono><span className="muted">{fmtTs(l.ts)}</span></TD>
                <TD>
                  <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded"
                        style={{
                          background: l.level === "ERROR" || l.level === "CRITICAL" ? "rgba(244,63,94,.12)"
                            : l.level === "WARNING" ? "rgba(245,185,66,.12)" : "rgba(255,255,255,.06)",
                          color: l.level === "ERROR" || l.level === "CRITICAL" ? "#f43f5e"
                            : l.level === "WARNING" ? "#f5b942" : "var(--text-soft)",
                        }}>
                    {l.level}
                  </span>
                </TD>
                <TD><span className="muted">{l.name}</span></TD>
                <TD><span className="block max-w-[440px] truncate">{l.msg}</span></TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SurfaceSection>
  );
}

/* ── loading shell ──────────────────────────────────────────────────────── */
function ExecutionLoadingShell({
  connStatus,
  error,
}: {
  connStatus: string;
  error?: string | null;
}) {
  const offline    = connStatus !== "connected" && connStatus !== "connecting";
  const connecting = connStatus === "connecting";
  const errored    = connStatus === "error" || Boolean(error);

  const dot   = errored ? "dead" : offline ? "dead" : "warn";
  const pulse = !errored && !offline;

  const title =
    errored
      ? "Connection error"
      : offline
      ? "Execution engine offline"
      : connecting
      ? "Connecting to execution engine…"
      : "Waiting for first snapshot…";

  const body =
    errored
      ? (error ?? "The execution engine connection was rejected.")
      : offline
      ? "Start the execution engine (AQ Agent) and reload to stream live telemetry."
      : connecting
      ? "Opening the WebSocket connection to the execution engine."
      : "Connected - waiting for the first state snapshot from the execution engine.";

  return (
    <div className="space-y-4">
      <div className="panel state-block" style={{ minHeight: 200 }}>
        <span
          className={`dot dot-${dot}${pulse ? " pulse" : ""}`}
          style={{ width: 10, height: 10 }}
        />
        <div className="text-sm font-medium">{title}</div>
        <p className="muted text-xs max-w-[300px] leading-5">{body}</p>
      </div>
      {!errored && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([0, 1, 2, 3] as const).map(i => (
            <div key={i} className="kpi">
              <div className="skeleton h-2 w-16 mb-3 rounded" />
              <div className="skeleton h-5 w-20 mb-2 rounded" />
              <div className="skeleton h-2 w-14 rounded" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Signal-related event types the engine reports (see ui_bridge's STATUS_TO_EVENT_TYPE map). */
const SIGNAL_TAB_EVENT_TYPES = new Set([
  "signal.received", "signal.triggered", "signal.opened",
  "risk.approved", "risk.rejected", "trade.error",
]);

export default function Execution() {
  const {
    status: connStatus,
    error,
    connectedMt5,
    autotradingEnabled,
    signalEngineConnected,
    engine: engineSnap,
    system: rawSystem,
    config,
    metrics: rawMetrics,
    trades: rawTrades,
    riskGuards: rawGuards,
    events,
    logs,
    lastMetricsAt,
    isStale,
  } = useExecutionEngine();

  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const hasSnapshot = engineSnap !== null;
  const metrics = rawMetrics ?? {};
  const system  = rawSystem ?? {};
  const version = String(engineSnap?.version ?? "?");
  const engineMode = pickStr(metrics, "engine_mode", "mode")
    ?? (engineSnap?.mode ? String(engineSnap.mode) : undefined);

  const positions = rawTrades.map(normalizePos);
  const guards    = rawGuards as unknown as RGuard[];

  const signals    = events
    .filter(e => SIGNAL_TAB_EVENT_TYPES.has(e.event_type))
    .map((e, i) => normalizeSig(e.data, i));
  const rejections = events.filter(e => REJECTION_EVENT_TYPES.has(e.event_type));
  const activity   = events.filter(e => ACTIVITY_EVENT_TYPES.has(e.event_type));
  const eventLog    = events;

  return (
    <div className="page-wrap space-y-5">
      <PageHeader
        eyebrow="Private execution domain"
        title="My Execution"
        description="Live account, risk, trade, and broker execution telemetry from the execution engine."
      />

      {!hasSnapshot && (
        <ExecutionLoadingShell connStatus={connStatus} error={error} />
      )}

      {hasSnapshot && <>
      <Tabs
        tabs={TABS.map(tab => ({
          id: tab.id,
          label: tab.label,
          count:
            tab.id === "rejections" && rejections.length ? rejections.length :
            tab.id === "activity"   && activity.length   ? activity.length :
            tab.id === "events"     && eventLog.length   ? eventLog.length :
            tab.id === "logs"       && logs.length       ? logs.length : undefined,
        }))}
        active={activeTab}
        onChange={id => setActiveTab(id as TabId)}
      />

      {activeTab === "overview"      && (
        <OverviewTab
          metrics={metrics} engineMode={engineMode} version={version}
          connStatus={connStatus} connectedMt5={connectedMt5} autotradingEnabled={autotradingEnabled}
          signalEngineConnected={signalEngineConnected}
          lastMetricsAt={lastMetricsAt} isStale={isStale}
        />
      )}
      {activeTab === "configuration" && <ConfigurationTab config={config} version={version} />}
      {activeTab === "metrics"       && <MetricsTab     metrics={metrics} />}
      {activeTab === "performance"   && <PerformanceTab metrics={metrics} system={system} />}
      {activeTab === "positions"     && <PositionsTab   positions={positions} />}
      {activeTab === "signals"       && <SignalsTab     signals={signals} />}
      {activeTab === "guards"        && <GuardsTab      guards={guards} />}
      {activeTab === "rejections"    && <RejectionsTab  items={rejections} />}
      {activeTab === "activity"      && <ActivityTab    items={activity} />}
      {activeTab === "events"        && <EventsTab      items={eventLog} />}
      {activeTab === "logs"          && <LogsTab        lines={logs} />}
      </>}
    </div>
  );
}
