"use client";

import { PageHeader, SectionHead, StreamBanner } from "@/components/metric-detail";
import { useGateway } from "@/components/gateway-provider";
import { createBrowserSupabase } from "@/lib/supabase";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
]);
const ACTIVITY_EVENT_TYPES = new Set([
  "trade.opened",    "trade.closed",    "trade.tp1_hit",
  "trade.tp2_hit",   "trade.sl_hit",    "order.filled",
  "position.partial_tp", "position.updated", "position.sync",
]);

const EVENT_COLORS: Record<string, string> = {
  "trade.opened":        "#3ddc97",
  "trade.closed":        "#f43f5e",
  "trade.tp1_hit":       "#3ddc97",
  "trade.tp2_hit":       "#3ddc97",
  "trade.sl_hit":        "#f43f5e",
  "order.filled":        "#3ddc97",
  "position.partial_tp": "#f5b942",
  "position.updated":    "rgba(255,255,255,.5)",
  "position.sync":       "rgba(255,255,255,.5)",
  "strategy.rejected":   "#f43f5e",
  "signal.rejected":     "#f43f5e",
  "risk.rejected":       "#f43f5e",
  "parity.warning":      "#f5b942",
  "signal.filtered":     "#f5b942",
  "health.check":        "rgba(255,255,255,.3)",
};
function eventColor(type: string): string {
  return EVENT_COLORS[type] ?? "rgba(255,255,255,.45)";
}

/* ── format helpers ─────────────────────────────────────────────────────── */
function isN(v: unknown): v is number { return typeof v === "number" && !isNaN(v); }

function money(v: unknown, signed = false): string {
  if (!isN(v)) return "—";
  const sign = signed && v >= 0 ? "+" : v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(v: unknown, signed = false): string {
  if (!isN(v)) return "—";
  return `${signed && v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function cnt(v: unknown): string {
  if (!isN(v)) return "—";
  return v.toLocaleString("en-US");
}

function ratio(v: unknown): string {
  if (!isN(v)) return "—";
  return v.toFixed(2);
}

function msf(v: unknown): string {
  if (!isN(v)) return "—";
  return `${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}ms`;
}

function fmtPrice(n: number): string {
  if (n === 0) return "—";
  if (n > 1000) return n.toFixed(2);
  if (n > 10)   return n.toFixed(3);
  return n.toFixed(5);
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
    ticket:     (t.ticket ?? t.id ?? "—") as string | number,
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
    timeframe:  String(raw.timeframe ?? raw.tf ?? "—"),
    strategy:   String(raw.strategy ?? raw.strat ?? "—"),
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
    tone === "good"   ? "#3ddc97" :
    tone === "warn"   ? "#f5b942" :
    tone === "danger" ? "#f43f5e" :
    "rgba(255,255,255,.22)";
  return (
    <div className="h-1.5 w-full rounded-full overflow-hidden"
         style={{ background: "rgba(255,255,255,.06)", marginTop: 8 }}>
      {p !== undefined && (
        <div className="h-full rounded-full" style={{ width: `${p}%`, background: bg, transition: "width .3s" }} />
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
          <StatCard label="Engine Mode"        value={engineMode || "—"} />
        </div>
      </section>
    </div>
  );
}

/* ── Positions tab ──────────────────────────────────────────────────────── */
function PositionsTab({ positions }: { positions: NPos[] }) {
  if (positions.length === 0) {
    return (
      <div className="panel state-block">
        <div className="font-medium">No open positions</div>
        <p className="muted text-xs">Positions appear here when the engine opens trades.</p>
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden">
      <div className="panel-head">
        <div>
          <div className="text-sm font-semibold">Open Trades</div>
          <p className="muted text-xs mt-0.5">{positions.length} position{positions.length !== 1 ? "s" : ""}</p>
        </div>
        <span className="badge badge-green">{positions.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-xs">
          <thead>
            <tr>
              {["Ticket", "Symbol", "Side", "Size", "Entry", "SL", "TP", "P&L", "P&L %", "Strategy"].map(c => (
                <TH key={c}>{c}</TH>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((pos, i) => {
              const pnlPct = pos.openPrice > 0
                ? (pos.profit / (pos.openPrice * pos.volume)) * 100 : 0;
              return (
                <tr key={i} style={TR_BORDER}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.025)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <TD mono><span className="muted">{String(pos.ticket)}</span></TD>
                  <TD mono><span className="font-bold text-white">{pos.symbol}</span></TD>
                  <TD><DirBadge dir={pos.direction} /></TD>
                  <TD mono>{pos.volume}</TD>
                  <TD mono>{fmtPrice(pos.openPrice)}</TD>
                  <TD mono><span className="muted">{fmtPrice(pos.stopLoss)}</span></TD>
                  <TD mono><span className="muted">{fmtPrice(pos.takeProfit)}</span></TD>
                  <TD mono>
                    <span style={{ color: pos.profit >= 0 ? "#3ddc97" : "#f43f5e", fontWeight: 600 }}>
                      {pos.profit >= 0 ? "+" : ""}{pos.profit.toFixed(2)}
                    </span>
                  </TD>
                  <TD mono>
                    <span style={{ color: pnlPct >= 0 ? "#3ddc97" : "#f43f5e" }}>
                      {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                    </span>
                  </TD>
                  <TD><span className="muted">{pos.strategy ?? "—"}</span></TD>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Signals tab ────────────────────────────────────────────────────────── */
function SignalsTab({ signals }: { signals: NSig[] }) {
  if (signals.length === 0) {
    return (
      <div className="panel state-block">
        <div className="font-medium">No signals yet</div>
        <p className="muted text-xs">Signal events appear here when received by the engine.</p>
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden">
      <div className="panel-head">
        <div>
          <div className="text-sm font-semibold">Recent Signals</div>
          <p className="muted text-xs mt-0.5">Signals received by this engine</p>
        </div>
        <span className="badge badge-green">{signals.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-xs">
          <thead>
            <tr>
              {["Time", "Symbol", "TF", "Strategy", "Side", "Conf", "Entry", "SL", "TP", "Setup", "Status"].map(c => (
                <TH key={c}>{c}</TH>
              ))}
            </tr>
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
                <TD mono>{sig.confidence !== undefined ? `${(sig.confidence * 100).toFixed(0)}%` : "—"}</TD>
                <TD mono>{fmtPrice(sig.entry)}</TD>
                <TD mono><span className="muted">{fmtPrice(sig.stopLoss)}</span></TD>
                <TD mono><span className="muted">{fmtPrice(sig.takeProfit)}</span></TD>
                <TD>
                  <span className="muted block max-w-[200px] truncate">{sig.setup ?? "—"}</span>
                </TD>
                <TD><SigBadge status={sig.status} /></TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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

      {/* Raw counters / gauges — only when populated */}
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

  return (
    <div className="space-y-2">
      {guards.map(guard => {
        const guardPct = guard.threshold > 0
          ? (guard.current_value / guard.threshold) * 100 : undefined;
        const isActive = guard.status.toUpperCase() === "ACTIVE";
        const isPaused = guard.status.toUpperCase() === "PAUSED";
        const tone: Tone = !isActive ? "normal"
          : isN(guardPct) && guardPct >= 90 ? "danger"
          : isN(guardPct) && guardPct >= 70 ? "warn"
          : "good";

        return (
          <div key={guard.id} className="panel p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{guard.name}</div>
                {guard.description && (
                  <p className="text-xs muted mt-0.5 leading-5">{guard.description}</p>
                )}
              </div>
              <span className={`badge shrink-0 ${isActive ? "badge-green" : isPaused ? "badge-warn" : "badge-muted"}`}>
                {guard.status}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-4 text-xs">
              <div>
                <span className="muted">Current </span>
                <span className={`mono font-semibold${valCls(tone)}`}>
                  {guard.current_value} {guard.unit}
                </span>
              </div>
              <div>
                <span className="muted">Limit </span>
                <span className="mono">{guard.threshold} {guard.unit}</span>
              </div>
              {isN(guardPct) && (
                <span className={`mono text-[11px]${valCls(tone)}`}>{guardPct.toFixed(1)}%</span>
              )}
            </div>
            {isN(guardPct) && <MeterBar value={guardPct} tone={tone} />}
          </div>
        );
      })}
    </div>
  );
}

/* ── Rejections tab ─────────────────────────────────────────────────────── */
function RejectionsTab({ items }: { items: EventEntry[] }) {
  if (!items.length) {
    return (
      <div className="panel state-block">
        <div className="font-medium">No rejections</div>
        <p className="muted text-xs">Strategy and risk rejections will appear here as events arrive via the gateway.</p>
      </div>
    );
  }
  return (
    <div className="panel overflow-hidden">
      <div className="panel-head">
        <div>
          <div className="text-sm font-semibold">Rejections</div>
          <p className="muted text-xs mt-0.5">{items.length} rejection{items.length !== 1 ? "s" : ""} accumulated</p>
        </div>
        <span className="badge" style={{ background: "rgba(244,63,94,.15)", color: "#f43f5e", border: "1px solid rgba(244,63,94,.3)" }}>
          {items.length}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-xs">
          <thead>
            <tr>{["Time", "Source", "Symbol", "Strategy", "Reason"].map(c => <TH key={c}>{c}</TH>)}</tr>
          </thead>
          <tbody>
            {items.map(ev => {
              const d = ev.data;
              const srcLabel = ev.event_type.split(".").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
              return (
                <tr key={ev.id} style={TR_BORDER}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.025)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <TD mono><span className="muted">{fmtTs(ev.ts)}</span></TD>
                  <TD>
                    <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded"
                          style={{ background: "rgba(244,63,94,.12)", color: "#f43f5e" }}>
                      {srcLabel}
                    </span>
                  </TD>
                  <TD mono><span className="font-bold text-white">{String(d.symbol ?? "—")}</span></TD>
                  <TD><span className="muted">{String(d.strategy ?? d.strat ?? "—")}</span></TD>
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

/* ── Activity tab ───────────────────────────────────────────────────────── */
function ActivityTab({ items }: { items: EventEntry[] }) {
  if (!items.length) {
    return (
      <div className="panel state-block">
        <div className="font-medium">No activity yet</div>
        <p className="muted text-xs">Order fills, trade opens / closes, and TP / SL hits will appear here.</p>
      </div>
    );
  }
  return (
    <div className="panel overflow-hidden">
      <div className="panel-head">
        <div>
          <div className="text-sm font-semibold">Activity</div>
          <p className="muted text-xs mt-0.5">{items.length} event{items.length !== 1 ? "s" : ""} accumulated</p>
        </div>
        <span className="badge badge-muted">{items.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-xs">
          <thead>
            <tr>{["Time", "Action", "Symbol", "Ticket", "Side", "Vol", "Price", "P&L"].map(c => <TH key={c}>{c}</TH>)}</tr>
          </thead>
          <tbody>
            {items.map(ev => {
              const d = ev.data;
              const action = ev.event_type.split(".").pop()
                ?.replace(/_/g, " ").toUpperCase() ?? ev.event_type;
              const dir = d.direction ?? d.side ?? d.dir;
              const profit = typeof d.profit === "number" ? d.profit
                : typeof d.pnl === "number" ? d.pnl
                : typeof d.net_profit === "number" ? d.net_profit
                : undefined;
              const rawPrice = d.price ?? d.entry_price ?? d.close_price ?? d.fill_price;
              const rawVol   = d.volume ?? d.lots ?? d.size;
              return (
                <tr key={ev.id} style={TR_BORDER}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.025)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <TD mono><span className="muted">{fmtTs(ev.ts)}</span></TD>
                  <TD>
                    <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded"
                          style={{ background: "rgba(61,220,151,.12)", color: "#3ddc97" }}>
                      {action}
                    </span>
                  </TD>
                  <TD mono><span className="font-bold text-white">{String(d.symbol ?? "—")}</span></TD>
                  <TD mono><span className="muted">{String(d.ticket ?? d.id ?? "—")}</span></TD>
                  <TD>
                    {dir ? <DirBadge dir={normalizeDir(dir)} /> : <span className="muted">—</span>}
                  </TD>
                  <TD mono>
                    <span className="muted">
                      {rawVol !== undefined && !isNaN(Number(rawVol)) ? String(rawVol) : "—"}
                    </span>
                  </TD>
                  <TD mono>
                    <span className="muted">
                      {rawPrice !== undefined && !isNaN(Number(rawPrice))
                        ? fmtPrice(Number(rawPrice)) : "—"}
                    </span>
                  </TD>
                  <TD mono>
                    {profit !== undefined
                      ? <span style={{ color: profit > 0 ? "#3ddc97" : profit < 0 ? "#f43f5e" : undefined, fontWeight: 600 }}>
                          {profit >= 0 ? "+" : ""}{profit.toFixed(2)}
                        </span>
                      : <span className="muted">—</span>}
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
        <p className="muted text-xs">All execution events forwarded by the gateway will be logged here in real time.</p>
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
                        style={{ color: eventColor(ev.event_type) }}>
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

/* ── page ───────────────────────────────────────────────────────────────── */
export default function Execution() {
  const gateway = useGateway();
  const { setExecutionMetricsEngine, status: gwStatus } = gateway;
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [engines, setEngines]         = useState<EngineOption[]>([]);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [enginesLoading, setEnginesLoading] = useState(true);
  const [activeTab, setActiveTab]     = useState<TabId>("overview");

  /* ── event accumulation ─────────────────────────────────────────────── */
  const seenRef    = useRef<Set<string>>(new Set());
  const [rejections, setRejections] = useState<EventEntry[]>([]);
  const [activity,   setActivity]   = useState<EventEntry[]>([]);
  const [eventLog,   setEventLog]   = useState<EventEntry[]>([]);

  const loadEngines = useCallback(async () => {
    if (!supabase) { setEnginesLoading(false); return; }
    const { data } = await supabase
      .from("engine_devices")
      .select("id,engine_id,device_name")
      .eq("status", "active")
      .order("activated_at", { ascending: false });
    const rows = (data ?? []) as EngineOption[];
    setEngines(rows);
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

  useEffect(() => {
    if (gwStatus === "authenticated" && selectedId) {
      setExecutionMetricsEngine(selectedId);
    } else {
      setExecutionMetricsEngine(null);
    }
    return () => setExecutionMetricsEngine(null);
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

  const streamReady  = Boolean(snapshot) && !gateway.executionMetricsError;
  const streamStatus = gateway.executionMetricsError ?? undefined;

  /* Engine selector */
  const engineSelector = !enginesLoading && engines.length > 1 ? (
    <div className="relative">
      <select
        value={selectedId ?? ""}
        onChange={e => setSelectedId(e.target.value || null)}
        className="appearance-none pl-3 pr-8 py-2 text-xs cursor-pointer min-w-[200px]"
        style={{
          background:   "var(--surface-raised)",
          border:       "1px solid var(--line-strong)",
          borderRadius: "var(--radius-control)",
          color:        "var(--text-soft)",
          outline:      "none",
        }}
      >
        {engines.map(e => (
          <option key={e.id} value={e.engine_id} style={{ background: "#0d1015" }}>
            {e.device_name || e.engine_id}
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 muted pointer-events-none" />
    </div>
  ) : !enginesLoading && engines.length === 1 ? (
    <span className="pill text-xs">{engines[0].device_name || engines[0].engine_id}</span>
  ) : undefined;

  return (
    <div className="page-wrap space-y-5">
      <PageHeader
        eyebrow="Private execution domain"
        title="My Execution"
        description="Owner-scoped account, risk, trade, and broker execution telemetry from your installed engine."
        right={engineSelector}
      />

      {!enginesLoading && engines.length === 0 && (
        <div className="panel state-block">
          <div className="font-medium">No activated execution engines</div>
          <p className="muted text-xs max-w-xs">
            Install the Execution Engine and activate it with a key from Licenses &amp; Keys
            to stream private execution metrics.
          </p>
        </div>
      )}

      {!enginesLoading && engines.length > 0 && (
        <>
          <StreamBanner domain="execution.metrics" ready={streamReady} status={streamStatus}>
            Private stream scoped to the selected engine. The Gateway verifies ownership before
            forwarding any account data.
          </StreamBanner>

          {/* Tab strip — scrollable so all 8 tabs fit on small screens */}
          <div className="overflow-x-auto no-scrollbar">
            <div className="flex gap-0.5 p-1 rounded-lg w-fit"
                 style={{ background: "var(--surface-raised)", border: "1px solid var(--line)" }}>
              {TABS.map(tab => {
                const count =
                  tab.id === "rejections" ? rejections.length :
                  tab.id === "activity"   ? activity.length :
                  tab.id === "logs"       ? eventLog.length : 0;
                const isRej = tab.id === "rejections" && count > 0;
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
                    {count > 0 && (
                      <span
                        className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold tabular-nums"
                        style={{
                          background: isRej ? "rgba(244,63,94,.25)" : "rgba(255,255,255,.12)",
                          color:      isRej ? "#f43f5e" : "rgba(255,255,255,.5)",
                        }}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {activeTab === "overview"    && <OverviewTab    metrics={metrics} engineMode={engineMode} />}
          {activeTab === "positions"   && <PositionsTab   positions={positions} />}
          {activeTab === "signals"     && <SignalsTab     signals={signals} />}
          {activeTab === "metrics"     && <MetricsTab     metrics={metrics} />}
          {activeTab === "guards"      && <GuardsTab      guards={guards} />}
          {activeTab === "rejections"  && <RejectionsTab  items={rejections} />}
          {activeTab === "activity"    && <ActivityTab    items={activity} />}
          {activeTab === "logs"        && <LogsTab        items={eventLog} />}
        </>
      )}
    </div>
  );
}
