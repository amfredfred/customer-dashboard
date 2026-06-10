"use client";

import { PageHeader, SectionHead } from "@/components/metric-detail";
import { useGateway } from "@/components/gateway-provider";
import { useAuth } from "@/components/auth-provider";
import { gatewayHttpBase } from "@/lib/gateway";
import { getBrowserSupabase } from "@/lib/supabase-singleton";
import { ChevronDown, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MetricCard } from "@/components/ui/metric-card";
import { Tabs } from "@/components/ui/tabs";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { EventFeed, type FeedEvent, type FeedTone } from "@/components/ui/event-feed";
import { CommandBar } from "@/components/ui/command-bar";
import { SurfaceSection } from "@/components/ui/surface";

/* ── types ─────────────────────────────────────────────────────────────── */
type EngineOption = { id: string; engine_id: string; device_name: string };
type Tone = "normal" | "good" | "warn" | "danger";
type TabId =
  | "overview" | "positions" | "signals" | "metrics" | "guards"
  | "rejections" | "activity" | "logs";

/** Execution events buffered by the gateway and merged into every snapshot. */
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
  { id: "overview",    label: "Overview"    },
  { id: "positions",   label: "Positions"   },
  { id: "signals",     label: "Signals"     },
  { id: "metrics",     label: "Metrics"     },
  { id: "guards",      label: "Risk Guards" },
  { id: "rejections",  label: "Rejections"  },
  { id: "activity",    label: "Activity"    },
  { id: "logs",        label: "Logs"        },
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

/* ── Overview tab ───────────────────────────────────────────────────────── */
function OverviewTab({ metrics, engineMode }: {
  metrics: Record<string, unknown>;
  engineMode?: string;
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
        <SectionHead label="Engine Health" />
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
      <div className="surface state-block">
        <div className="font-medium">No open positions</div>
        <p className="muted text-xs">Positions appear here when the engine opens trades.</p>
      </div>
    );
  }

  return (
    <SurfaceSection
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
      <div className="surface state-block">
        <div className="font-medium">No signals yet</div>
        <p className="muted text-xs">Signal events appear here when received by the engine.</p>
      </div>
    );
  }

  return (
    <SurfaceSection
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
        />
        <GaugeCard
          label="Daily Loss"
          value={isN(dailyLossPct) ? dailyLossPct : undefined}
          display={pct(dailyLossPct)}
          context={`Limit ${pct(dailyLossLimitPct)}`}
          tone={usageTone(dailyLossPct)}
        />
        <GaugeCard
          label="Margin Level"
          value={isN(marginLevel) ? Math.min(marginLevel, 100) : undefined}
          display={pct(marginLevel)}
          context="Broker account margin"
          tone={isN(marginLevel) && marginLevel < 150 ? "warn" : isN(marginLevel) ? "good" : "normal"}
        />
        <GaugeCard
          label="Win Rate"
          value={isN(winRate) ? winRate : undefined}
          display={pct(winRate)}
          context="Closed trade hit rate"
          tone={isN(winRate) && winRate >= 50 ? "good" : "normal"}
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

/* ── Guards tab ─────────────────────────────────────────────────────────── */
function GuardsTab({ guards }: { guards: RGuard[] }) {
  if (guards.length === 0) {
    return (
      <div className="panel state-block">
        <div className="font-medium">No risk guards</div>
        <p className="muted text-xs">Risk guard data is not present in the current snapshot.</p>
      </div>
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
  items, title, subtitle, emptyTitle, emptyBody, dangerBadge,
}: {
  items: EventEntry[];
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyBody: string;
  dangerBadge?: boolean;
}) {
  if (!items.length) {
    return (
      <div className="surface state-block">
        <div className="font-medium">{emptyTitle}</div>
        <p className="muted text-xs">{emptyBody}</p>
      </div>
    );
  }
  return (
    <SurfaceSection
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
      emptyTitle="No rejections"
      emptyBody="Strategy and risk rejections will appear here as events arrive via the gateway."
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
      emptyTitle="No activity yet"
      emptyBody="Order fills, trade opens / closes, and TP / SL hits will appear here."
    />
  );
}

function LogsTab({ items }: { items: EventEntry[] }) {
  return (
    <EventTab
      items={items}
      title="Event Log"
      subtitle={`${items.length} event${items.length !== 1 ? "s" : ""} (max 500)`}
      emptyTitle="No events yet"
      emptyBody="All execution events forwarded by the gateway will be logged here in real time."
    />
  );
}

/* ── loading shell ──────────────────────────────────────────────────────── */
type LoadPhase = "engines" | "stream" | "forbidden";
function ExecutionLoadingShell({
  phase,
  gwStatus = "",
  error,
}: {
  phase: LoadPhase;
  gwStatus?: string;
  error?: string;
}) {
  const offline    = gwStatus !== "authenticated" && gwStatus !== "connecting";
  const connecting = gwStatus === "connecting";
  const forbidden  = phase === "forbidden" || Boolean(error);

  const dot   = forbidden ? "dead" : offline ? "dead" : "warn";
  const pulse  = !forbidden && !offline;

  const title =
    phase === "engines"
      ? "Loading engines…"
      : forbidden
      ? "Stream access denied"
      : offline
      ? "Gateway offline"
      : connecting
      ? "Connecting to gateway…"
      : "Waiting for AQ Agent…";

  const body =
    phase === "engines"
      ? "Fetching your activated engine list from the database."
      : forbidden
      ? (error ?? "The gateway could not verify ownership of this AQ Agent. Check that it is activated under your license.")
      : offline
      ? "Start the execution gateway and reload to stream execution metrics."
      : connecting
      ? "Authenticating with the gateway - this only takes a moment."
      : "Gateway is subscribed and waiting for the first metrics snapshot from AQ Agent.";

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
      {/* Skeleton KPIs hint at the layout that will appear */}
      {!forbidden && (
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


/* ── Remote control types ───────────────────────────────────────────────── */
type CmdType  = "command.pause" | "command.resume" | "command.emergency_stop";
type CmdPhase = "idle" | "sending" | "pending" | "delivered" | "completed" | "failed";

interface CmdState {
  id:    string | null;
  type:  CmdType | null;
  phase: CmdPhase;
  error: string | null;
}

/** Live engine state used by the remote-control panel to gate each button. */
interface EngineControlState {
  /** True once the first execution-metrics snapshot has arrived. */
  snapshotAvailable: boolean;
  /**
   * True when the engine is command-paused (signal queue held by an explicit
   * pause command).  Does NOT reflect risk-guard pauses - those can't be
   * cleared remotely via Resume.
   */
  isPaused: boolean;
  /** Count of currently open MT5 positions tracked by the engine. */
  openPositionsCount: number;
}

interface ConfirmConfig {
  command:      CmdType;
  title:        string;
  description:  string;
  confirmLabel: string;
  destructive:  boolean;
}

const IDLE_CMD: CmdState = { id: null, type: null, phase: "idle", error: null };

/* ── Confirmation dialog ────────────────────────────────────────────────── */
function CommandConfirmDialog({
  open, config, loading, error, onCancel, onConfirm,
}: {
  open:     boolean;
  config:   ConfirmConfig | null;
  loading:  boolean;
  error:    string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // Ensure we only render the portal on the client (document.body not
  // available during SSR / Next.js App Router initial server render).
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!open || !config || !mounted) return null;

  // Render through a portal so the overlay is a direct child of <body>,
  // escaping any ancestor transform / overflow / stacking-context that would
  // break position:fixed inside the dashboard shell.
  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,.65)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
      onClick={!loading ? onCancel : undefined}
    >
      <div
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--line-strong)",
          borderRadius: 10, padding: "24px 26px",
          maxWidth: 420, width: "100%",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Title */}
        <div className="text-sm font-semibold" style={{ marginBottom: 10, color: "var(--text)" }}>
          {config.title}
        </div>

        {/* Description */}
        <p style={{
          fontSize: 13, lineHeight: 1.6,
          color: "rgba(255,255,255,.52)",
          whiteSpace: "pre-line",
          marginBottom: error ? 12 : 22,
        }}>
          {config.description}
        </p>

        {/* Error message (stays open on failure) */}
        {error && (
          <div style={{
            background: "rgba(244,63,94,.1)",
            border: "1px solid rgba(244,63,94,.25)",
            borderRadius: 6, padding: "8px 11px",
            color: "#f43f5e", fontSize: 12, marginBottom: 18,
          }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            disabled={loading && !error}
            className="text-xs font-medium rounded-md"
            style={{
              padding: "7px 15px",
              background: "rgba(255,255,255,.06)",
              border: "1px solid rgba(255,255,255,.1)",
              color: "rgba(255,255,255,.55)",
              cursor: loading && !error ? "default" : "pointer",
              opacity: loading && !error ? 0.45 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={!loading ? onConfirm : undefined}
            className="flex items-center gap-1.5 text-xs font-semibold rounded-md"
            style={{
              padding: "7px 16px",
              background: config.destructive ? "rgba(244,63,94,.14)" : "rgba(255,255,255,.08)",
              border: `1px solid ${config.destructive ? "rgba(244,63,94,.35)" : "rgba(255,255,255,.15)"}`,
              color: config.destructive ? "#f43f5e" : "var(--text)",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading && <Loader2 size={11} className="animate-spin" />}
            {config.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── Remote control panel ───────────────────────────────────────────────── */
function RemoteControlPanel({
  engineId,
  controlState,
  engineSelector,
}: {
  engineId:       string | null;
  controlState:   EngineControlState;
  engineSelector?: React.ReactNode;
}) {
  const { session } = useAuth();

  const [cmd, setCmd]               = useState<CmdState>(IDLE_CMD);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCfg,  setConfirmCfg]  = useState<ConfirmConfig | null>(null);
  const [confirmErr,  setConfirmErr]  = useState<string | null>(null);

  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollGenRef = useRef(0);
  const errCountRef = useRef(0);

  const { snapshotAvailable, isPaused, openPositionsCount } = controlState;
  const inFlight = cmd.phase !== "idle";

  /* Availability gates */
  const canPause     = snapshotAvailable && !isPaused  && !inFlight;
  const canResume    = snapshotAvailable &&  isPaused  && !inFlight;
  const canEmergency = openPositionsCount > 0          && !inFlight;

  /* Human-readable disabled reasons (shown as title tooltip) */
  const pauseReason: string | null =
    inFlight          ? "Command pending - waiting for engine response."
    : !snapshotAvailable ? "Waiting for engine stream…"
    : isPaused           ? "Pause unavailable - engine is already paused."
    : null;

  const resumeReason: string | null =
    inFlight          ? "Command pending - waiting for engine response."
    : !snapshotAvailable ? "Resume unavailable - engine state unknown."
    : !isPaused          ? "Resume unavailable - engine is not paused."
    : null;

  const emergencyReason: string | null =
    inFlight          ? "Command pending - waiting for engine response."
    : openPositionsCount === 0 ? "Emergency unavailable - no open positions."
    : null;

  /* Reset on engine change */
  useEffect(() => {
    setCmd(IDLE_CMD);
    setConfirmOpen(false);
    setConfirmCfg(null);
    setConfirmErr(null);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [engineId]);

  /* Auto-close dialog on completion; surface error on failure */
  useEffect(() => {
    if (cmd.phase === "completed") {
      setConfirmOpen(false);
      setConfirmErr(null);
      const t = setTimeout(() => setCmd(IDLE_CMD), 1500);
      return () => clearTimeout(t);
    }
    if (cmd.phase === "failed") {
      setConfirmErr(cmd.error ?? "Command failed");
    }
  }, [cmd.phase, cmd.error]);

  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const pollStatus = useCallback((commandId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    errCountRef.current = 0;
    const gen = ++pollGenRef.current;
    pollRef.current = setInterval(async () => {
      if (gen !== pollGenRef.current) return;           // stale series
      try {
        const token = session?.access_token;
        if (!token) { stopPoll(); return; }
        const res = await fetch(`${gatewayHttpBase()}/commands/${commandId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (gen !== pollGenRef.current) return;
        if (!res.ok) {
          if (++errCountRef.current >= 3) {
            stopPoll();
            setCmd(prev => ({ ...prev, phase: "failed", error: `Poll error ${res.status}` }));
          }
          return;
        }
        errCountRef.current = 0;
        const data = await res.json() as { status?: string };
        if (gen !== pollGenRef.current) return;
        const s = data.status ?? "";
        if (s === "completed") {
          stopPoll();
          setCmd(prev => ({ ...prev, phase: "completed" }));
        } else if (s === "failed" || s === "expired") {
          stopPoll();
          setCmd(prev => ({ ...prev, phase: "failed", error: `Command ${s}` }));
        } else if (s === "delivered") {
          setCmd(prev => ({ ...prev, phase: "delivered" }));
        }
      } catch { /* transient - keep polling */ }
    }, 2500);
  }, [session]);

  /* Step 1 - open confirmation */
  const requestCommand = (type: CmdType) => {
    if (inFlight) return;
    if (type === "command.pause"         && !canPause)     return;
    if (type === "command.resume"        && !canResume)    return;
    if (type === "command.emergency_stop" && !canEmergency) return;

    const cfgs: Record<CmdType, ConfirmConfig> = {
      "command.pause": {
        command: "command.pause",
        title: "Pause Engine?",
        description: "This will stop the engine from processing new execution actions until resumed.\n\nOpen positions will not be closed by this action.",
        confirmLabel: "Pause Engine",
        destructive: false,
      },
      "command.resume": {
        command: "command.resume",
        title: "Resume Engine?",
        description: "This will allow the engine to continue processing execution actions.",
        confirmLabel: "Resume Engine",
        destructive: false,
      },
      "command.emergency_stop": {
        command: "command.emergency_stop",
        title: "Emergency Action?",
        description: `This should only be used when immediate risk control is required.\n\nOpen positions detected: ${openPositionsCount}`,
        confirmLabel: "Run Emergency",
        destructive: true,
      },
    };
    setConfirmCfg(cfgs[type]);
    setConfirmErr(null);
    setConfirmOpen(true);
  };

  /* Step 2 - execute after user confirms */
  const executeConfirmed = async () => {
    if (!confirmCfg || !engineId || !session?.access_token) return;
    if (inFlight) return;                               // prevent double-submit

    const type = confirmCfg.command;
    setCmd({ id: null, type, phase: "sending", error: null });

    try {
      const res = await fetch(`${gatewayHttpBase()}/commands`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ engine_id: engineId, command_type: type }),
      });
      const data = await res.json() as { command_id?: string; error?: string };
      if (!res.ok || !data.command_id) {
        setCmd({ id: null, type, phase: "failed", error: data.error ?? `HTTP ${res.status}` });
        return;
      }
      setCmd({ id: data.command_id, type, phase: "pending", error: null });
      pollStatus(data.command_id);
    } catch (err) {
      setCmd({ id: null, type, phase: "failed", error: String(err) });
    }
  };

  /* Close dialog - only possible when not actively in-flight (or after failure) */
  const closeConfirm = () => {
    const canClose = !inFlight || cmd.phase === "failed";
    if (!canClose) return;
    if (cmd.phase === "failed") { stopPoll(); setCmd(IDLE_CMD); }
    setConfirmOpen(false);
    setConfirmCfg(null);
    setConfirmErr(null);
  };

  if (!engineId) return null;


  return (
    <>
      <CommandConfirmDialog
        open={confirmOpen}
        config={confirmCfg}
        loading={inFlight && cmd.phase !== "failed"}
        error={confirmErr}
        onCancel={closeConfirm}
        onConfirm={() => void executeConfirmed()}
      />

      <CommandBar
        context={
          <span className="text-[10px] font-bold uppercase tracking-[.1em]"
                style={{ color: "var(--muted)" }}>
            Engine Control
          </span>
        }
        commands={[
          {
            id: "pause",
            label: "Pause",
            variant: "warn",
            disabled: !canPause,
            disabledReason: pauseReason ?? undefined,
            onClick: () => requestCommand("command.pause"),
          },
          {
            id: "resume",
            label: "Resume",
            variant: "success",
            disabled: !canResume,
            disabledReason: resumeReason ?? undefined,
            onClick: () => requestCommand("command.resume"),
          },
          {
            id: "emergency",
            label: "Emergency Stop",
            dangerous: true,
            disabled: !canEmergency,
            disabledReason: emergencyReason ?? undefined,
            onClick: () => requestCommand("command.emergency_stop"),
          },
        ]}
        right={engineSelector}
      />
    </>
  );
}

/* ── Engine selector dropdown ───────────────────────────────────────────── */
function EngineDropdown({
  engines,
  selectedId,
  onChange,
}: {
  engines: EngineOption[];
  selectedId: string | null;
  onChange: (engineId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = engines.find(e => e.engine_id === selectedId) ?? engines[0];

  /* close on outside click */
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  if (engines.length === 0) return null;

  /* single engine - rich two-line static display */
  if (engines.length === 1) {
    const e = engines[0];
    return (
      <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl w-full"
           style={{ background: "var(--surface-3)", border: "1px solid var(--line-strong)" }}>
        <span className="dot dot-live pulse shrink-0" style={{ width: 7, height: 7 }} />
        <div className="min-w-0">
          <div className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>
            {e.device_name || "Unnamed Engine"}
          </div>
          <div className="text-[10px] font-mono mt-0.5 truncate" style={{ color: "var(--muted)" }}>
            {e.engine_id.slice(0, 20)}…
          </div>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ml-auto"
              style={{ background: "var(--success-bg)", color: "var(--success)", border: "1px solid var(--success-border)" }}>
          Connected
        </span>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger - two-line rich display */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all w-full"
        style={{
          background: "var(--surface-3)",
          border:     `1px solid ${open ? "var(--line-strong)" : "var(--line)"}`,
          outline:    "none",
          boxShadow:  open ? "0 0 0 1px rgba(255,255,255,.06)" : "none",
        }}
      >
        <span className="dot dot-live pulse shrink-0" style={{ width: 7, height: 7 }} />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>
            {selected ? (selected.device_name || "Unnamed Engine") : "Select engine"}
          </div>
          <div className="text-[10px] font-mono mt-0.5 truncate" style={{ color: "var(--muted)" }}>
            {selected ? `${selected.engine_id.slice(0, 18)}… · ${engines.length} engines` : `${engines.length} engines`}
          </div>
        </div>
        <ChevronDown
          size={13}
          className="shrink-0 transition-transform"
          style={{ color: "var(--muted)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {/* Panel */}
      {open && (
        <div
          className="absolute right-0 mt-1.5 z-50 rounded-xl overflow-hidden"
          style={{
            minWidth:  240,
            background: "#0e1015",
            border:    "1px solid rgba(255,255,255,.1)",
            boxShadow: "0 8px 32px rgba(0,0,0,.55), 0 2px 8px rgba(0,0,0,.4)",
          }}
        >
          {/* Header */}
          <div className="px-3.5 py-2.5 border-b"
               style={{ borderColor: "rgba(255,255,255,.06)" }}>
            <div className="text-[10px] font-bold uppercase tracking-widest muted">
              AQ Agents
            </div>
          </div>

          {/* Options */}
          <div className="py-1.5">
            {engines.map(e => {
              const isActive = e.engine_id === selectedId;
              const label    = e.device_name || e.engine_id;
              return (
                <button
                  key={e.id}
                  onClick={() => { onChange(e.engine_id); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors"
                  style={{
                    background: isActive ? "rgba(61,220,151,.07)" : "transparent",
                    color:      isActive ? "#3ddc97" : "rgba(255,255,255,.7)",
                  }}
                  onMouseEnter={ev => { if (!isActive) (ev.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)"; }}
                  onMouseLeave={ev => { if (!isActive) (ev.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {/* Selection indicator */}
                  <span
                    className="w-4 h-4 rounded-full shrink-0 grid place-items-center"
                    style={{
                      background:  isActive ? "rgba(61,220,151,.15)" : "transparent",
                      border:      isActive ? "1.5px solid #3ddc97" : "1.5px solid rgba(255,255,255,.15)",
                      transition: "all .15s",
                    }}
                  >
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#3ddc97" }} />
                    )}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{label}</div>
                    <div className="text-[10px] muted mono truncate mt-0.5">{e.engine_id}</div>
                  </div>

                  {isActive && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: "rgba(61,220,151,.12)", color: "#3ddc97" }}>
                      Watching
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── No-engines empty state ─────────────────────────────────────────────── */

const WAVE_BADGE: React.CSSProperties = {
  display: "inline-block",
  background: "rgba(255,255,255,.022)",
  color: "rgba(255,255,255,.65)",
  fontWeight: 900,
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
  padding: "7px 16px",
  WebkitMaskImage: [
    "radial-gradient(circle at 50% 0%,   transparent 5px, white 5.5px)",
    "radial-gradient(circle at 50% 100%, transparent 5px, white 5.5px)",
    "linear-gradient(white, white)",
  ].join(", "),
  WebkitMaskSize:     "10px 10px, 10px 10px, 100% calc(100% - 10px)",
  WebkitMaskPosition: "top, bottom, 0 5px",
  WebkitMaskRepeat:   "repeat-x, repeat-x, no-repeat",
  maskImage: [
    "radial-gradient(circle at 50% 0%,   transparent 5px, white 5.5px)",
    "radial-gradient(circle at 50% 100%, transparent 5px, white 5.5px)",
    "linear-gradient(white, white)",
  ].join(", "),
  maskSize:     "10px 10px, 10px 10px, 100% calc(100% - 10px)",
  maskPosition: "top, bottom, 0 5px",
  maskRepeat:   "repeat-x, repeat-x, no-repeat",
};

function SubscribeIllustration() {
  return (
    <svg viewBox="0 0 200 88" fill="none" className="w-full h-auto">
      {/* billing card */}
      <rect x="14" y="14" width="80" height="60" rx="7"
            fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.09)" strokeWidth="1"/>
      <rect x="14" y="14" width="80" height="18" rx="7" fill="rgba(255,255,255,.06)"/>
      <rect x="14" y="28" width="80" height="4" fill="rgba(255,255,255,.06)"/>
      {/* plan badge */}
      <rect x="22" y="38" width="30" height="8" rx="3"
            fill="rgba(61,220,151,.12)" stroke="rgba(61,220,151,.3)" strokeWidth=".8"/>
      <rect x="26" y="41" width="22" height="2" rx="1" fill="rgba(61,220,151,.55)"/>
      {/* price */}
      <rect x="22" y="52" width="44" height="5" rx="2" fill="rgba(255,255,255,.1)"/>
      <rect x="22" y="60" width="28" height="3" rx="1.5" fill="rgba(255,255,255,.06)"/>
      {/* checkmark */}
      <circle cx="80" cy="22" r="6" fill="rgba(61,220,151,.15)" stroke="rgba(61,220,151,.4)" strokeWidth="1"/>
      <path d="M77 22 L79.5 24.5 L83 20" stroke="#3ddc97" strokeWidth="1.3"
            strokeLinecap="round" strokeLinejoin="round"/>
      {/* right side - license key block */}
      <rect x="110" y="22" width="72" height="44" rx="6"
            fill="rgba(61,220,151,.05)" stroke="rgba(61,220,151,.18)" strokeWidth="1"/>
      <rect x="118" y="30" width="56" height="3" rx="1.5" fill="rgba(255,255,255,.1)"/>
      <rect x="118" y="37" width="42" height="3" rx="1.5" fill="rgba(255,255,255,.07)"/>
      <rect x="118" y="44" width="50" height="3" rx="1.5" fill="rgba(255,255,255,.06)"/>
      {/* key icon */}
      <circle cx="122" cy="56" r="5" fill="none" stroke="rgba(61,220,151,.45)" strokeWidth="1.1"/>
      <circle cx="122" cy="56" r="2" fill="rgba(61,220,151,.3)" stroke="#3ddc97" strokeWidth=".9"/>
      <rect x="126" y="54.5" width="14" height="3" rx="1.5" fill="rgba(255,255,255,.12)"/>
      <rect x="132" y="57.5" width="3" height="4" rx="1" fill="rgba(255,255,255,.12)"/>
      <rect x="137" y="57.5" width="3" height="5.5" rx="1" fill="rgba(255,255,255,.12)"/>
      {/* connect dash */}
      <line x1="94" y1="44" x2="110" y2="44"
            stroke="rgba(61,220,151,.2)" strokeWidth="1" strokeDasharray="3,2.5"/>
    </svg>
  );
}

function InstallEngineIllustration() {
  return (
    <svg viewBox="0 0 200 88" fill="none" className="w-full h-auto">
      {/* installer window */}
      <rect x="14" y="10" width="88" height="68" rx="7"
            fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.09)" strokeWidth="1"/>
      <rect x="14" y="10" width="88" height="18" rx="7" fill="rgba(255,255,255,.06)"/>
      <rect x="14" y="24" width="88" height="4" fill="rgba(255,255,255,.06)"/>
      <circle cx="24" cy="19" r="2.5" fill="rgba(244,63,94,.35)"/>
      <circle cx="32" cy="19" r="2.5" fill="rgba(245,185,66,.35)"/>
      <circle cx="40" cy="19" r="2.5" fill="rgba(61,220,151,.35)"/>
      <rect x="50" y="16" width="30" height="3" rx="1.5" fill="rgba(255,255,255,.12)"/>
      {/* chip icon */}
      <rect x="30" y="34" width="28" height="24" rx="4"
            fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.09)" strokeWidth="1"/>
      <rect x="35" y="38" width="18" height="16" rx="2"
            fill="rgba(255,255,255,.025)" stroke="rgba(255,255,255,.06)" strokeWidth="1"/>
      <polyline points="37,46 40,46 42,41 44,51 46,41 48,51 50,46 51,46"
                stroke="#3ddc97" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity=".8"/>
      {/* progress bar */}
      <rect x="24" y="64" width="68" height="5" rx="2.5" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.07)" strokeWidth=".8"/>
      <rect x="24" y="64" width="48" height="5" rx="2.5" fill="rgba(61,220,151,.4)"/>
      {/* download arrow */}
      <circle cx="148" cy="36" r="18" fill="rgba(61,220,151,.07)" stroke="rgba(61,220,151,.2)" strokeWidth="1.2"/>
      <line x1="148" y1="27" x2="148" y2="38" stroke="#3ddc97" strokeWidth="1.6" strokeLinecap="round"/>
      <polyline points="141,35 148,43 155,35" stroke="#3ddc97" strokeWidth="1.6" fill="none"
                strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="137" y="47" width="22" height="2.5" rx="1.25" fill="rgba(61,220,151,.3)"/>
      <rect x="140" y="52" width="16" height="2" rx="1" fill="rgba(61,220,151,.18)"/>
      <line x1="102" y1="44" x2="128" y2="36"
            stroke="rgba(255,255,255,.08)" strokeWidth="1" strokeDasharray="2.5,2.5"/>
    </svg>
  );
}

function StreamIllustration() {
  return (
    <svg viewBox="0 0 200 88" fill="none" className="w-full h-auto">
      {/* engine chip */}
      <rect x="14" y="24" width="52" height="48" rx="6"
            fill="rgba(61,220,151,.06)" stroke="rgba(61,220,151,.2)" strokeWidth="1"/>
      <rect x="21" y="32" width="38" height="32" rx="3"
            fill="rgba(255,255,255,.025)" stroke="rgba(61,220,151,.1)" strokeWidth="1"/>
      {/* live waveform */}
      <polyline points="23,48 27,48 30,39 33,57 36,39 39,57 42,48 45,48 48,43 52,43"
                stroke="#3ddc97" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity=".9"/>
      <ellipse cx="38" cy="48" rx="14" ry="8" fill="#3ddc97" fillOpacity=".05"/>
      {/* status dot */}
      <circle cx="40" cy="64" r="2.5" fill="#3ddc97" opacity=".8"/>
      <circle cx="40" cy="64" r="5" fill="#3ddc97" fillOpacity=".1"/>
      {/* connection dash */}
      <line x1="70" y1="48" x2="96" y2="48"
            stroke="rgba(61,220,151,.25)" strokeWidth="1.2" strokeDasharray="3,2"/>
      <circle cx="84" cy="48" r="2.5" fill="#3ddc97" opacity=".5"/>
      {/* dashboard panel */}
      <rect x="100" y="12" width="84" height="64" rx="7"
            fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.09)" strokeWidth="1"/>
      <rect x="100" y="12" width="84" height="16" rx="7" fill="rgba(255,255,255,.05)"/>
      <rect x="100" y="24" width="84" height="4" fill="rgba(255,255,255,.05)"/>
      <rect x="108" y="14" width="28" height="2.5" rx="1.25" fill="rgba(255,255,255,.12)"/>
      {/* mini chart inside dashboard */}
      <polyline points="108,52 115,46 122,54 129,42 136,50 143,44 150,48 157,38 165,46 172,42 179,44"
                stroke="#3ddc97" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity=".7"/>
      <rect x="108" y="58" width="66" height="2.5" rx="1.25" fill="rgba(255,255,255,.07)"/>
      <rect x="108" y="63" width="44" height="2" rx="1" fill="rgba(255,255,255,.05)"/>
      {/* live badge on dashboard */}
      <rect x="142" y="13" width="24" height="10" rx="3"
            fill="rgba(61,220,151,.12)" stroke="rgba(61,220,151,.3)" strokeWidth=".8"/>
      <circle cx="148" cy="18" r="1.8" fill="#3ddc97" opacity=".8"/>
      <rect x="151" y="16.5" width="12" height="2" rx="1" fill="rgba(61,220,151,.6)"/>
    </svg>
  );
}

function NoEnginesState({ hasLicense }: { hasLicense: boolean }) {
  const steps = [
    {
      Illustration: SubscribeIllustration,
      done: hasLicense,
      badge: "Step 1",
      name: "Get a subscription",
      desc: hasLicense
        ? "License active. Your subscription is set up - head to Licenses & Keys to manage keys and install AQ Agent."
        : "Choose a plan on the Billing page. After checkout, an activation key is provisioned for each device slot on your license.",
      features: ["Choose Starter or Pro plan", "License provisioned instantly", "One key per device slot", "Managed from Licenses & Keys"],
      cta: { label: hasLicense ? "View Licenses & Keys →" : "Go to Billing →", href: hasLicense ? "/app/licenses" : "/app/billing", active: true },
    },
    {
      Illustration: InstallEngineIllustration,
      done: false,
      badge: "Step 2",
      name: "Install AQ Agent",
      desc: "Download the AQ Agent installer from Licenses & Keys. Run it on your Windows PC or VPS - the setup wizard handles everything.",
      features: ["Windows 10 / 11 or Server", "Runs on any VPS provider", "MT5 must be installed", "One AQ Agent per device slot"],
      cta: { label: "Download from Licenses & Keys →", href: "/app/licenses", active: true },
    },
    {
      Illustration: StreamIllustration,
      done: false,
      badge: "Step 3",
      name: "Activate & stream live data",
      desc: "Paste your activation key into AQ Agent's config.yaml. AQ Agent connects, registers itself, and this page starts streaming live execution telemetry.",
      features: ["Paste key into config.yaml", "AQ Agent auto-registers on first run", "Live P&L, signals & guards", "Telemetry updates in real time"],
      cta: { label: "Data appears here automatically", href: null, active: false },
    },
  ];

  const doneBadge: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    background: "rgba(61,220,151,.12)",
    color: "#3ddc97",
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    padding: "5px 12px",
    borderRadius: 999,
    border: "1px solid rgba(61,220,151,.3)",
  };

  return (
    <div className="flex justify-center mt-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-4xl">
        {steps.map(({ Illustration, done, badge, name, desc, features, cta }) => (
          <div key={name}
               className="panel flex flex-col overflow-hidden"
               style={{ border: "none", opacity: done ? 0.55 : 1, transition: "opacity .2s" }}>
            <div className="px-4 pt-4 pb-1"><Illustration /></div>
            <div className="px-5 pt-2 pb-4">
              <div className="text-sm font-semibold mb-0.5">{name}</div>
              <div className="text-[11px] muted leading-snug">{desc}</div>
              <div className="mt-3">
                {done ? (
                  <span style={doneBadge}>
                    <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5">
                      <path d="M2 6 L5 9 L10 3" stroke="#3ddc97" strokeWidth="1.6"
                            strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Done
                  </span>
                ) : (
                  <div style={WAVE_BADGE}>{badge}</div>
                )}
              </div>
            </div>
            <div className="px-5 pt-1 pb-5 flex flex-col flex-1">
              <ul className="mb-5 flex flex-col gap-1.5" style={{ minHeight: 88 }}>
                {features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-[11px] muted">
                    <span className="w-1 h-1 rounded-full shrink-0"
                          style={{ background: "var(--success)", opacity: done ? 0.4 : 0.7 }} />
                    {f}
                  </li>
                ))}
              </ul>
              {cta.href ? (
                <a href={cta.href}
                   className="flex items-center justify-center py-2.5 rounded text-xs font-semibold transition-opacity hover:opacity-80"
                   style={{ background: "rgba(61,220,151,.1)", color: "#3ddc97", border: "1px solid rgba(61,220,151,.25)", textDecoration: "none" }}>
                  {cta.label}
                </a>
              ) : (
                <div className="flex items-center justify-center py-2.5 rounded text-xs font-semibold"
                     style={{ background: "rgba(255,255,255,.03)", color: "rgba(255,255,255,.25)", border: "1px solid rgba(255,255,255,.06)" }}>
                  {cta.label}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Execution() {
  const gateway = useGateway();
  const { setExecutionMetricsEngine, status: gwStatus } = gateway;
  const supabase = getBrowserSupabase();

  const [engines, setEngines]         = useState<EngineOption[]>([]);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [enginesLoading, setEnginesLoading] = useState(true);
  const [hasLicense, setHasLicense]   = useState(false);
  const [activeTab, setActiveTab]     = useState<TabId>("overview");

  /* ── event accumulation ─────────────────────────────────────────────── */
  const seenRef    = useRef<Set<string>>(new Set());
  const [rejections, setRejections] = useState<EventEntry[]>([]);
  const [activity,   setActivity]   = useState<EventEntry[]>([]);
  const [eventLog,   setEventLog]   = useState<EventEntry[]>([]);

  const loadEngines = useCallback(async () => {
    if (!supabase) { setEnginesLoading(false); return; }
    const [devResult, licResult] = await Promise.all([
      supabase
        .from("engine_devices")
        .select("id,engine_id,device_name")
        .eq("status", "active")
        .order("activated_at", { ascending: false }),
      supabase
        .from("licenses")
        .select("id")
        .limit(1),
    ]);
    const rows = (devResult.data ?? []) as EngineOption[];
    setEngines(rows);
    setHasLicense((licResult.data?.length ?? 0) > 0);
    if (rows.length > 0) setSelectedId(prev => prev ?? rows[0].engine_id);
    setEnginesLoading(false);
  }, [supabase]);

  useEffect(() => { void loadEngines(); }, [loadEngines]);

  /* Clear accumulated events when the selected engine changes */
  useEffect(() => {
    seenRef.current.clear();
    setRejections([]);
    setActivity([]);
    setEventLog([]);
  }, [selectedId]);

  /* Override the shell's baseline subscription when the user selects a
     specific engine on this page. No cleanup - the shell keeps a live
     subscription alive across navigation; we don't null it on unmount. */
  useEffect(() => {
    if (gwStatus === "authenticated" && selectedId) {
      setExecutionMetricsEngine(selectedId);
    }
  }, [gwStatus, selectedId, setExecutionMetricsEngine]);

  /* Accumulate events from each incoming snapshot */
  const snapshot   = gateway.executionMetrics;

  useEffect(() => {
    if (!snapshot) return;
    const recentEvents = (snapshot as Record<string, unknown>).recent_events as EventEntry[] | undefined;
    if (!recentEvents?.length) return;

    const newRej: EventEntry[] = [];
    const newAct: EventEntry[] = [];
    const newLog: EventEntry[] = [];

    for (const ev of recentEvents) {
      if (seenRef.current.has(ev.id)) continue;
      seenRef.current.add(ev.id);
      newLog.push(ev);
      if (REJECTION_EVENT_TYPES.has(ev.event_type)) newRej.push(ev);
      else if (ACTIVITY_EVENT_TYPES.has(ev.event_type)) newAct.push(ev);
    }

    if (newLog.length === 0) return;
    setEventLog(prev => [...newLog, ...prev].slice(0, 500));
    if (newRej.length) setRejections(prev => [...newRej, ...prev].slice(0, 200));
    if (newAct.length) setActivity(prev =>   [...newAct, ...prev].slice(0, 200));
  }, [snapshot]);

  /* Data extraction */
  const metrics    = (snapshot?.metrics   ?? {}) as Record<string, unknown>;
  const rawTrades  = (snapshot?.trades    ?? []) as Record<string, unknown>[];
  const rawSigs    = (snapshot?.signals   ?? []) as Record<string, unknown>[];
  const rawGuards  = (snapshot?.riskGuards ?? []) as Record<string, unknown>[];
  const engineSnap = snapshot?.engine as Record<string, unknown> | undefined;
  const engineMode = pickStr(metrics, "engine_mode", "mode")
    ?? (engineSnap?.mode ? String(engineSnap.mode) : undefined);

  const positions = rawTrades.map(normalizePos);
  const signals   = rawSigs.map((s, i) => normalizeSig(s, i));
  const guards    = rawGuards as unknown as RGuard[];

  const streamStatus = gateway.executionMetricsError ?? undefined;

  /* Derive engine control state for the remote-control panel.
   * `is_paused` is the command-driven pause flag emitted by the engine in
   * every execution-metrics snapshot (added in ui_bridge._build_engine_info).
   * Falls back to checking status === "PAUSED" for older engine builds. */
  const engineControlState: EngineControlState = {
    snapshotAvailable: Boolean(snapshot),
    isPaused:
      engineSnap?.is_paused === true ||
      (engineSnap?.is_paused === undefined && engineSnap?.status === "PAUSED"),
    openPositionsCount: positions.length,
  };

  return (
    <div className="page-wrap space-y-5">
      <PageHeader
        eyebrow="Private execution domain"
        title="My Execution"
        description="Owner-scoped account, risk, trade, and broker execution telemetry from your installed engine."
      />

      {/* 1 - DB query in progress */}
      {enginesLoading && <ExecutionLoadingShell phase="engines" />}

      {/* 2 - No engines registered */}
      {!enginesLoading && engines.length === 0 && <NoEnginesState hasLicense={hasLicense} />}

      {!enginesLoading && engines.length > 0 && (
        <>
          {/* Remote controls - always visible once an engine is selected */}
          <RemoteControlPanel
            engineId={selectedId}
            controlState={engineControlState}
            engineSelector={
              <EngineDropdown
                engines={engines}
                selectedId={selectedId}
                onChange={id => setSelectedId(id)}
              />
            }
          />

          {/* 3 - Engines found but stream not yet live */}
          {!snapshot && (
            <ExecutionLoadingShell
              phase={streamStatus ? "forbidden" : "stream"}
              gwStatus={gwStatus}
              error={streamStatus}
            />
          )}

          {/* 4 - Live: tab strip + content (only when snapshot is present) */}
          {snapshot && <>
          <Tabs
            tabs={TABS.map(tab => ({
              id: tab.id,
              label: tab.label,
              count:
                tab.id === "rejections" && rejections.length ? rejections.length :
                tab.id === "activity"   && activity.length   ? activity.length :
                tab.id === "logs"       && eventLog.length   ? eventLog.length : undefined,
            }))}
            active={activeTab}
            onChange={id => setActiveTab(id as TabId)}
          />

          {activeTab === "overview"    && <OverviewTab    metrics={metrics} engineMode={engineMode} />}
          {activeTab === "positions"   && <PositionsTab   positions={positions} />}
          {activeTab === "signals"     && <SignalsTab     signals={signals} />}
          {activeTab === "metrics"     && <MetricsTab     metrics={metrics} />}
          {activeTab === "guards"      && <GuardsTab      guards={guards} />}
          {activeTab === "rejections"  && <RejectionsTab  items={rejections} />}
          {activeTab === "activity"    && <ActivityTab    items={activity} />}
          {activeTab === "logs"        && <LogsTab        items={eventLog} />}
          </>}
        </>
      )}
    </div>
  );
}
