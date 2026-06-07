"use client";

import { DataTable, DetailSection, EmptyTable, Metric, MetricGrid, PageHeader, StreamBanner } from "@/components/metric-detail";
import { useGateway } from "@/components/gateway-provider";
import { createBrowserSupabase } from "@/lib/supabase";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

/* ── types ────────────────────────────────────────────────────────────── */
type EngineOption = { id: string; engine_id: string; device_name: string };

/* ── page ────────────────────────────────────────────────────────────── */
export default function Execution() {
  const gateway = useGateway();
  const { setExecutionMetricsEngine, status: gwStatus } = gateway;
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [engines, setEngines] = useState<EngineOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [enginesLoading, setEnginesLoading] = useState(true);

  /* Load owned engines */
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

  /* Subscribe when both gateway is authenticated AND an engine is selected.
     Tying to gwStatus ensures navigation to this page re-subscribes even when
     the socket is already open (avoids the StrictMode double-invoke race). */
  useEffect(() => {
    if (gwStatus === "authenticated" && selectedId) {
      setExecutionMetricsEngine(selectedId);
    } else {
      setExecutionMetricsEngine(null);
    }
    return () => setExecutionMetricsEngine(null);
  }, [gwStatus, selectedId, setExecutionMetricsEngine]);

  /* Metric helpers */
  const snapshot = gateway.executionMetrics;
  const metrics  = snapshot?.metrics ?? {};
  const number   = (key: string) => typeof metrics[key] === "number" ? metrics[key] as number : undefined;
  const count    = (key: string) => number(key)?.toLocaleString("en-US") ?? "--";
  const money    = (key: string) => number(key) === undefined ? "--" : `$${number(key)!.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pct      = (key: string) => number(key) === undefined ? "--" : `${number(key)!.toFixed(2)}%`;
  const ms       = (key: string) => number(key) === undefined ? "--" : `${number(key)!.toLocaleString("en-US")}ms`;
  const notTracked = "Not tracked";

  const trades  = snapshot?.trades ?? [];
  const signals = snapshot?.signals ?? [];

  const streamReady   = Boolean(snapshot) && !gateway.executionMetricsError;
  const streamStatus  = gateway.executionMetricsError ?? undefined;

  const engineSelector = !enginesLoading && engines.length > 1 ? (
    <div className="relative">
      <select
        value={selectedId ?? ""}
        onChange={e => setSelectedId(e.target.value || null)}
        className="appearance-none pl-3 pr-8 py-2 text-xs cursor-pointer min-w-[200px]"
        style={{ background: "var(--surface-raised)", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-control)", color: "var(--text-soft)", outline: "none" }}
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

      {/* No engines */}
      {!enginesLoading && engines.length === 0 && (
        <div className="panel state-block">
          <div className="font-medium">No activated execution engines</div>
          <p className="muted text-xs max-w-xs">
            Install the Execution Engine and activate it with a key from Licenses &amp; Keys
            to stream private execution metrics.
          </p>
        </div>
      )}

      {/* Stream banner */}
      {(!enginesLoading && engines.length > 0) && (
        <StreamBanner domain="execution.metrics" ready={streamReady} status={streamStatus}>
          Private stream scoped to the selected engine. The Gateway verifies ownership before forwarding any account data.
        </StreamBanner>
      )}

      {/* Account snapshot */}
      <DetailSection title="Account Snapshot" subtitle="Current broker account state">
        <MetricGrid>
          <Metric label="Balance"       value={money("balance")}    detail={String(metrics.currency ?? "Account currency")} />
          <Metric label="Equity"        value={money("equity")}     detail={`Peak ${money("peak_equity")}`} />
          <Metric label="Daily P&L"     value={money("daily_pnl")} />
          <Metric label="Max Drawdown"  value={pct("drawdown_pct")} />
          <Metric label="Free Margin"   value={money("free_margin")} />
          <Metric label="Margin Level"  value={pct("margin_level")} />
          <Metric label="Unrealized P&L" value={money("net_pnl")} />
          <Metric label="Commission"    value={notTracked} detail="Requires broker history" />
        </MetricGrid>
      </DetailSection>

      {/* Risk state */}
      <DetailSection title="Risk State" subtitle="Live limits and available execution capacity">
        <MetricGrid>
          <Metric label="Daily Budget"     value={money("daily_budget")} />
          <Metric label="Budget Used"      value={money("daily_budget_used")} />
          <Metric label="Budget Left"      value={money("daily_budget_left")} />
          <Metric label="Risk Per Trade"   value={money("risk_per_trade")} />
          <Metric label="Daily Loss"       value={pct("daily_loss_pct")} />
          <Metric label="Daily Loss Limit" value={pct("daily_loss_limit_percent")} />
          <Metric label="Risk Slots"       value={count("risk_slots")} />
          <Metric label="Max Losing Streak" value={count("max_losing_streak")} />
        </MetricGrid>
      </DetailSection>

      <div className="grid xl:grid-cols-2 gap-5">
        <DetailSection title="Execution Flow" badge="orders">
          <MetricGrid>
            <Metric label="Open Trades"      value={count("open_trades")} />
            <Metric label="Trades Today"     value={count("total_trades_today")} />
            <Metric label="Orders Filled"    value={count("orders_filled")} />
            <Metric label="Orders Rejected"  value={count("orders_rejected")} />
            <Metric label="Orders Retried"   value={count("orders_retried")} />
            <Metric label="Partial Fills"    value={count("orders_partial_fills")} />
            <Metric label="Slippage Rejected" value={count("orders_slippage_rejected")} />
            <Metric label="Emergency Closes" value={count("orders_emergency_closes")} />
          </MetricGrid>
        </DetailSection>
        <DetailSection title="Signal Handling" badge="engine intake">
          <MetricGrid>
            <Metric label="Signals Received"    value={count("signals_received")} />
            <Metric label="Signals Triggered"   value={count("signals_triggered")} />
            <Metric label="Validation Rejected" value={count("signals_validation_failures")} />
            <Metric label="Risk Approved"       value={count("risk_approved")} />
            <Metric label="Risk Rejected"       value={count("risk_rejected")} />
            <Metric label="Trades Opened"       value={count("trades_opened")} />
            <Metric label="Duplicates Ignored"  value={count("signal_duplicates_ignored")} />
            <Metric label="Pending Signals"     value={count("pending_signals")} />
          </MetricGrid>
        </DetailSection>
      </div>

      <div className="grid xl:grid-cols-2 gap-5">
        <DetailSection title="Execution Latency" subtitle="End-to-end delivery and broker timing">
          <MetricGrid>
            <Metric label="Signal-to-Trade"    value={ms("latency_signal_to_trade_ms")} />
            <Metric label="Signal Age"          value={ms("latency_market_signal_age_ms")} />
            <Metric label="Emit-to-Receive"     value={ms("latency_emit_to_receive_ms")} />
            <Metric label="Receive-to-Execute"  value={ms("latency_receive_to_execute_ms")} />
            <Metric label="Execution Pipeline"  value={ms("latency_execution_pipeline_ms")} />
            <Metric label="Broker Round Trip"   value={ms("latency_broker_round_trip_ms")} />
            <Metric label="Average Slippage"    value={notTracked} />
            <Metric label="Average Spread"      value={notTracked} />
          </MetricGrid>
        </DetailSection>
        <DetailSection title="Trade Outcomes" subtitle="Private results from this account">
          <MetricGrid>
            <Metric label="Winning Trades" value={count("winning_trades")} />
            <Metric label="Losing Trades"  value={count("losing_trades")} />
            <Metric label="Win Rate"       value={pct("win_rate")} />
            <Metric label="Profit Factor"  value={notTracked} />
            <Metric label="Average R:R"    value={notTracked} />
            <Metric label="Executed R:R"   value={notTracked} />
            <Metric label="TP Hits"        value={String((number("trades_tp1_hit") ?? 0) + (number("trades_tp2_hit") ?? 0))} />
            <Metric label="SL Hits"        value={count("trades_sl_hit")} />
          </MetricGrid>
        </DetailSection>
      </div>

      {/* Open positions */}
      <DetailSection title="Open Positions" subtitle="Only positions belonging to the selected account" badge="private">
        <DataTable
          columns={["Ticket", "Symbol", "Side", "Size", "Entry", "SL", "TP", "P&L", "State"]}
          rows={trades.map(trade => [
            String(trade.ticket ?? "--"),
            String(trade.symbol ?? "--"),
            String(trade.side ?? "--"),
            String(trade.lots ?? "--"),
            String(trade.entry_price ?? "--"),
            String(trade.sl ?? "--"),
            String(trade.tp2 ?? trade.tp1 ?? "--"),
            String(trade.pnl ?? "--"),
            String(trade.state ?? "--"),
          ])}
          emptyMessage="No open positions."
        />
      </DetailSection>

      <div className="grid xl:grid-cols-2 gap-5">
        <DetailSection title="Recent Signals" subtitle="Signals received by this engine only">
          <DataTable
            columns={["Time", "Symbol", "Side", "Strategy", "Status"]}
            rows={signals.map(s => [
              String(s.timestamp ?? "--"),
              String(s.symbol ?? "--"),
              String(s.direction ?? "--"),
              String(s.strategy ?? "--"),
              String(s.status ?? "--"),
            ])}
            emptyMessage="No recent execution signal events."
          />
        </DetailSection>
        <DetailSection title="Order Activity" subtitle="Fills, closes, partial exits and failures">
          <EmptyTable
            columns={["Time", "Event", "Ticket", "Symbol", "Price", "P&L"]}
            message="No order activity received."
          />
        </DetailSection>
      </div>
    </div>
  );
}
