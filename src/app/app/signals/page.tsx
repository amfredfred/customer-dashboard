"use client";

import { DataTable, EmptyTable, DetailSection, Metric, MetricGrid, PageHeader, StreamBanner } from "@/components/metric-detail";
import { useGateway } from "@/components/gateway-provider";
import { useEffect, useMemo, useState } from "react";

export default function Signals() {
  const gateway = useGateway();
  const { setSignalMetricsSubscribed, signalMetrics, status } = gateway;
  const [nowMs, setNowMs] = useState(0);

  // Timer — runs independently of gateway state
  useEffect(() => {
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  // Subscribe exactly once when gateway is authenticated; unsubscribe on status change or unmount.
  // Tying to `status` avoids the StrictMode subscribe→unsubscribe→subscribe storm that
  // occurs when the socket is already open on client-side navigation.
  useEffect(() => {
    if (status !== "authenticated") return;
    setSignalMetricsSubscribed(true);
    return () => setSignalMetricsSubscribed(false);
  }, [status, setSignalMetricsSubscribed]);

  const view = useMemo(() => {
    const snapshot = signalMetrics;
    const metrics = snapshot?.metrics ?? {};
    const number = (key: string) => typeof metrics[key] === "number" ? metrics[key] as number : undefined;
    const rawCounters = typeof metrics.raw_counters === "object" ? metrics.raw_counters : {};
    const rawGauges = typeof metrics.raw_gauges === "object" ? metrics.raw_gauges : {};
    const sumPrefix = (prefix: string) => Object.entries(rawCounters)
      .filter(([key]) => key.startsWith(prefix))
      .reduce((sum, [, value]) => sum + value, 0);
    const sumMatch = (prefix: string, suffix: string) => Object.entries(rawCounters)
      .filter(([key]) => key.startsWith(prefix) && key.endsWith(suffix))
      .reduce((sum, [, value]) => sum + value, 0);
    const observed = snapshot?.observed_at;
    const observedMs = observed ? (observed < 1e12 ? observed * 1000 : observed) : undefined;
    const ageMs = observedMs && nowMs ? nowMs - observedMs : undefined;
    const tickErrors = number("scanner_tick_errors") ?? 0;
    const mt5Errors = number("mt5_errors") ?? 0;
    const scannerTicks = number("scanner_ticks") ?? 0;
    const mt5Calls = number("mt5_calls") ?? 0;
    const errorRate = ((tickErrors + mt5Errors) / Math.max(scannerTicks + mt5Calls, 1)) * 100;
    const health = status !== "authenticated"
      ? { value: "Offline", tone: "danger" as const, detail: "Gateway is not authenticated" }
      : !snapshot
        ? { value: "Connecting", tone: "warn" as const, detail: "Requesting the first Signal Engine snapshot" }
        : ageMs !== undefined && ageMs > 15000
          ? { value: "Stale", tone: "warn" as const, detail: `Last snapshot ${Math.round(ageMs / 1000)}s ago` }
          : errorRate >= 1
            ? { value: "Degraded", tone: "warn" as const, detail: `${errorRate.toFixed(2)}% scanner/API error rate` }
            : { value: "Healthy", tone: "good" as const, detail: tickErrors + mt5Errors > 0 ? `${tickErrors + mt5Errors} historical errors, ${errorRate.toFixed(2)}% rate` : "Live sanitized snapshot received" };
    return { number, rawCounters, rawGauges, sumPrefix, sumMatch, health };
  }, [nowMs, signalMetrics, status]);

  const count = (value?: number) => value === undefined ? "--" : value.toLocaleString("en-US");
  const ms = (value?: number) => value === undefined ? "--" : `${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}ms`;
  const notTracked = "Not tracked";
  const scheduler = signalMetrics?.scheduler ?? [];
  const activeSignals = signalMetrics?.active_signals ?? [];
  const rejectionRows = Object.entries(view.rawCounters)
    .filter(([key, value]) => value > 0 && (
      key.startsWith("signals.") &&
      (key.includes("blocked") || key.includes("skipped") || key.includes("no_"))
    ))
    .sort(([, left], [, right]) => right - left)
    .slice(0, 12)
    .map(([key, value]) => [key.replace("signals.", "").replaceAll("_", " "), count(value), "Signal Engine"]);

  return (
    <div className="page-wrap space-y-5">
      <PageHeader
        eyebrow="Public signal domain"
        title="Signal Performance"
        description="Sanitised Signal Engine health, strategy performance, and symbol telemetry. No broker account data appears here."
      />

      <StreamBanner domain="signal.metrics" ready={Boolean(signalMetrics)}>
        This view creates a demand-driven Gateway subscription. The upstream metrics connection closes when the final viewer leaves.
      </StreamBanner>

      <DetailSection title="Scanner Health" subtitle="Signal generation runtime and market data health">
        <MetricGrid>
          <Metric label="Scanner Ticks" value={count(view.number("scanner_ticks"))} />
          <Metric label="Tick Errors" value={count(view.number("scanner_tick_errors"))} />
          <Metric label="Pair Scans" value={count(view.rawCounters["scanner.pair_scans"])} />
          <Metric label="Analysis Cycles" value={count(view.number("analysis_started"))} />
          <Metric label="Market Data Calls" value={count(view.number("mt5_calls"))} />
          <Metric label="Market Data Errors" value={count(view.number("mt5_errors"))} />
          <Metric label="Active Signals" value={count(view.number("active_signals"))} />
          <Metric label="Engine Health" value={view.health.value} tone={view.health.tone} detail={view.health.detail} />
        </MetricGrid>
      </DetailSection>

      <DetailSection title="Signal Funnel" subtitle="How candidate setups move through the engine">
        <MetricGrid>
          <Metric label="Candidates Found" value={count(view.rawCounters["signals.rejections_found"])} />
          <Metric label="Signals Emitted" value={count(view.number("signals_emitted"))} />
          <Metric label="Signals Triggered" value={count(view.number("signals_triggered"))} />
          <Metric label="No Rejection" value={count(view.number("signals_no_rejection"))} />
          <Metric label="Trend Blocked" value={count(view.sumPrefix("signals.trend_blocked"))} />
          <Metric label="Quality Blocked" value={count(view.rawCounters["signals.quality_blocked"])} />
          <Metric label="Stale Skipped" value={count(view.number("signals_stale_skipped"))} />
          <Metric label="Dedup Blocked" value={count(view.number("signals_dedup_blocked"))} />
        </MetricGrid>
      </DetailSection>

      <div className="grid xl:grid-cols-2 gap-5">
        <DetailSection title="Runtime & Latency" subtitle="Scanner and broadcast timing">
          <MetricGrid>
            <Metric label="Scan Lag" value={ms(view.number("last_scan_lag_ms"))} />
            <Metric label="Emit Lag" value={ms(view.number("last_emit_lag_ms"))} />
            <Metric label="Analysis Duration" value={ms(view.number("last_analysis_ms"))} />
            <Metric label="Broadcast Duration" value={ms(view.rawGauges["latency.signal_broadcast_total_ms"])} />
            <Metric label="Active Signals" value={count(view.number("active_signals"))} />
            <Metric label="Active Zones" value={count(view.number("active_zones"))} />
            <Metric label="Watchlist Open" value={count(view.rawGauges["state.watchlist_open"])} />
            <Metric label="WebSocket Clients" value={count(view.number("websocket_clients"))} />
          </MetricGrid>
        </DetailSection>
        <DetailSection title="Performance Summary" subtitle="Global strategy results, never user-scoped">
          <MetricGrid>
            <Metric label="Win Rate" value={notTracked} />
            <Metric label="Profit Factor" value={notTracked} />
            <Metric label="Average R:R" value={notTracked} />
            <Metric label="Backtest / Live Parity" value={notTracked} />
            <Metric label="Signals This Session" value={count(view.number("signals_emitted"))} />
            <Metric label="Signals This Week" value={notTracked} />
            <Metric label="Best Strategy" value={notTracked} />
            <Metric label="Best Symbol" value={notTracked} />
          </MetricGrid>
        </DetailSection>
      </div>

      <DetailSection title="Scheduler" subtitle="Active symbol scan schedule">
        <DataTable
          columns={["Symbol", "Mode", "Ticks", "Last Fired", "Avg Duration", "P95 Duration"]}
          rows={scheduler.map(item => {
            const stats = item.tick_stats && typeof item.tick_stats === "object"
              ? Object.values(item.tick_stats as Record<string, Record<string, unknown>>)[0] ?? {}
              : {};
            const fired = typeof item.last_fired_at === "number"
              ? new Date(item.last_fired_at < 1e12 ? item.last_fired_at * 1000 : item.last_fired_at).toLocaleTimeString()
              : "--";
            return [
              String(item.symbol ?? "--"),
              String(item.mode ?? "--"),
              String(item.tick_count ?? "--"),
              fired,
              typeof stats.avg_ms === "number" ? ms(stats.avg_ms) : "--",
              typeof stats.p95_ms === "number" ? ms(stats.p95_ms) : "--",
            ];
          })}
          emptyMessage="No scheduler rows are active."
        />
      </DetailSection>

      <div className="grid xl:grid-cols-2 gap-5">
        <DetailSection title="Strategy Performance">
          <EmptyTable columns={["Strategy", "Signals", "Win Rate", "Avg R:R", "Profit Factor", "Health"]} message="Strategy outcome analytics are not tracked by the Signal Engine yet." />
        </DetailSection>
        <DetailSection title="Symbol Performance">
          <DataTable
            columns={["Symbol", "Pair Scans", "Signals Emitted", "Trend Blocked", "Scan Lag", "Health"]}
            rows={scheduler.map(item => {
              const symbol = String(item.symbol ?? "");
              const pairPrefix = `scanner.${symbol}.`;
              const activeForSymbol = activeSignals.filter(signal => signal.symbol === symbol).length;
              return [
                symbol || "--",
                count(view.sumMatch(pairPrefix, ".scans")),
                count(activeForSymbol),
                count(view.sumPrefix(`signals.trend_blocked.${symbol}`)),
                ms(view.rawGauges[`scanner.${symbol}.scheduler_lag_ms`]),
                view.health.value,
              ];
            })}
            emptyMessage="No symbol runtime metrics received."
          />
        </DetailSection>
      </div>

      <div className="grid xl:grid-cols-2 gap-5">
        <DetailSection title="Recent Signals" subtitle="Sanitized global signal feed">
          <DataTable
            columns={["Time", "Symbol", "TF", "Strategy", "Side", "Entry", "SL", "TP"]}
            rows={activeSignals.map(signal => [
              String(signal.entry_ts ?? signal.timestamp ?? "--"),
              String(signal.symbol ?? "--"),
              [signal.htfInterval ?? signal.htf_interval, signal.ltfInterval ?? signal.ltf_interval].filter(Boolean).join("/") || "--",
              String(signal.pattern ?? signal.strategy ?? "CRT"),
              String(signal.direction ?? signal.side ?? "--"),
              String(signal.entry ?? "--"),
              String(signal.sl ?? signal.stopLoss ?? signal.stop_loss ?? "--"),
              String(signal.tp2 ?? signal.tp ?? signal.takeProfit ?? "--"),
            ])}
            emptyMessage="No active public signals."
          />
        </DetailSection>
        <DetailSection title="Filter & Rejection Reasons" subtitle="Aggregated public counters; individual rejected payloads remain private">
          <DataTable columns={["Reason", "Count", "Scope"]} rows={rejectionRows} emptyMessage="No filter or rejection counters recorded." />
        </DetailSection>
      </div>
    </div>
  );
}
