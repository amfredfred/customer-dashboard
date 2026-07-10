"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

export type ExecutionConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export type ExecutionEventEntry = {
  id: string;
  event_type: string;
  ts: string;
  summary: string;
  data: Record<string, unknown>;
};

export type LogLine = { ts: number; level: string; name: string; msg: string };

type ExecutionValue = {
  status: ExecutionConnectionStatus;
  error: string | null;
  connectedMt5: boolean;
  engine: Record<string, unknown> | null;
  system: Record<string, unknown> | null;
  config: Record<string, unknown> | null;
  trades: Record<string, unknown>[];
  riskGuards: Record<string, unknown>[];
  clusterRisk: Record<string, unknown> | null;
  metrics: Record<string, unknown> | null;
  events: ExecutionEventEntry[];
  logs: LogLine[];
  lastMetricsAt: number | null;
  /** True once METRICS_UPDATE hasn't arrived for longer than STALE_MS, while still connected. */
  isStale: boolean;
};

const ExecutionEngineContext = createContext<ExecutionValue>({
  status: "disconnected",
  error: null,
  connectedMt5: false,
  engine: null,
  system: null,
  config: null,
  trades: [],
  riskGuards: [],
  clusterRisk: null,
  metrics: null,
  events: [],
  logs: [],
  lastMetricsAt: null,
  isStale: false,
});

const MAX_EVENTS = 500;
/** UIBridge pushes METRICS_UPDATE every 1.5s (_METRICS_PUSH_INTERVAL_SEC) - ~5x that is a safe stale threshold. */
const STALE_MS = 8_000;
const STALE_CHECK_INTERVAL_MS = 1_000;

const STATUS_TO_EVENT_TYPE: Record<string, string> = {
  RECEIVED: "signal.received",
  TRIGGERED: "signal.triggered",
  APPROVED: "risk.approved",
  REJECTED: "risk.rejected",
  OPENED: "trade.opened",
  FAILED: "trade.error",
};

function summarize(eventType: string, payload: Record<string, unknown>): string {
  if (payload.symbol) {
    const dir = payload.direction ?? "";
    return `${payload.symbol} ${dir}`.trim();
  }
  return String(payload.reason ?? payload.message ?? eventType);
}

function sigToEvent(sig: Record<string, unknown>): ExecutionEventEntry {
  const status = String(sig.status ?? "").toUpperCase();
  const eventType = STATUS_TO_EVENT_TYPE[status] ?? "signal.event";
  const id = String(sig.id ?? `${eventType}:${sig.timestamp ?? Date.now()}`);
  return {
    id,
    event_type: eventType,
    ts: String(sig.timestamp ?? new Date().toISOString()),
    summary: summarize(eventType, sig),
    data: sig,
  };
}

export function ExecutionEngineProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ExecutionConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [connectedMt5, setConnectedMt5] = useState(false);
  const [engine, setEngine] = useState<Record<string, unknown> | null>(null);
  const [system, setSystem] = useState<Record<string, unknown> | null>(null);
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [trades, setTrades] = useState<Record<string, unknown>[]>([]);
  const [riskGuards, setRiskGuards] = useState<Record<string, unknown>[]>([]);
  const [clusterRisk, setClusterRisk] = useState<Record<string, unknown> | null>(null);
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<ExecutionEventEntry[]>([]);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [lastMetricsAt, setLastMetricsAt] = useState<number | null>(null);
  const [isStale, setIsStale] = useState(false);
  const lastMetricsAtRef = useRef<number | null>(null);

  /* Staleness is time-based, not just message-based - re-check on an interval
     so the warning appears even if no new message ever arrives again. */
  useEffect(() => {
    const timer = setInterval(() => {
      const last = lastMetricsAtRef.current;
      setIsStale(last !== null && Date.now() - last > STALE_MS);
    }, STALE_CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let socket: WebSocket | null = null;

    const url = process.env.NEXT_PUBLIC_EXECUTION_ENGINE_WS_URL ?? "ws://localhost:8080";

    function markFresh() {
      lastMetricsAtRef.current = Date.now();
      setLastMetricsAt(lastMetricsAtRef.current);
      setIsStale(false);
    }

    function pushEvent(entry: ExecutionEventEntry) {
      setEvents(prev => {
        if (prev.some(e => e.id === entry.id)) return prev;
        return [entry, ...prev].slice(0, MAX_EVENTS);
      });
    }

    function connect() {
      if (stopped) return;
      setStatus("connecting");
      setError(null);
      socket = new WebSocket(url);

      socket.onopen = () => setStatus("connected");

      socket.onmessage = ev => {
        try {
          const message = JSON.parse(String(ev.data)) as {
            type?: string;
            payload?: unknown;
          };
          const type = message.type ?? "";
          const payload = (message.payload ?? {}) as Record<string, unknown>;

          if (type === "STATE_SNAPSHOT") {
            setConnectedMt5(Boolean(payload.connected));
            setEngine((payload.engine as Record<string, unknown>) ?? null);
            setSystem((payload.system as Record<string, unknown>) ?? null);
            setConfig((payload.config as Record<string, unknown>) ?? null);
            setTrades(Array.isArray(payload.trades) ? (payload.trades as Record<string, unknown>[]) : []);
            setRiskGuards(Array.isArray(payload.riskGuards) ? (payload.riskGuards as Record<string, unknown>[]) : []);
            setClusterRisk((payload.clusterRisk as Record<string, unknown>) ?? null);
            setMetrics((payload.metrics as Record<string, unknown>) ?? null);
            setLogs(Array.isArray(payload.logs) ? (payload.logs as LogLine[]) : []);
            const initialSignals = Array.isArray(payload.signals)
              ? (payload.signals as Record<string, unknown>[])
              : [];
            setEvents(initialSignals.map(sigToEvent).slice(0, MAX_EVENTS));
            markFresh();
            return;
          }

          if (type === "METRICS_UPDATE") {
            setMetrics(payload);
            markFresh();
            return;
          }

          if (type === "trade.opened") {
            const id = payload.id;
            setTrades(prev => (id ? [payload, ...prev.filter(t => t.id !== id)] : [payload, ...prev]));
            pushEvent({
              id: `trade.opened:${id ?? Date.now()}`,
              event_type: "trade.opened",
              ts: new Date().toISOString(),
              summary: summarize("trade.opened", payload),
              data: payload,
            });
            return;
          }

          if (type === "trade.tp2_hit" || type === "trade.sl_hit" || type === "trade.closed") {
            const tradeId = payload.trade_id;
            setTrades(prev => prev.filter(t => t.id !== tradeId));
            pushEvent({
              id: `${type}:${tradeId ?? Date.now()}`,
              event_type: type,
              ts: new Date().toISOString(),
              summary: `Trade ${tradeId ?? ""} ${type.split(".").pop()}`.trim(),
              data: payload,
            });
            return;
          }

          if (type === "trade.tp1_hit") {
            const tradeId = payload.trade_id;
            pushEvent({
              id: `trade.tp1_hit:${tradeId ?? Date.now()}`,
              event_type: type,
              ts: new Date().toISOString(),
              summary: `Trade ${tradeId ?? ""} TP1 hit`.trim(),
              data: payload,
            });
            return;
          }

          if (
            type === "signal.received" ||
            type === "signal.triggered" ||
            type === "signal.opened" ||
            type === "risk.approved" ||
            type === "risk.rejected" ||
            type === "trade.error"
          ) {
            pushEvent(sigToEvent(payload));
            return;
          }

          if (type === "engine.paused" || type === "engine.resumed") {
            setEngine(prev => ({
              ...(prev ?? {}),
              is_paused: type === "engine.paused",
              status: type === "engine.paused" ? "PAUSED" : "RUNNING",
            }));
            return;
          }
        } catch {
          setError("Execution engine returned an invalid message");
        }
      };

      socket.onerror = () => setError("Cannot reach execution engine");
      socket.onclose = () => {
        socket = null;
        if (stopped) return;
        setStatus("disconnected");
        reconnectTimer = setTimeout(connect, 3000);
      };
    }

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  return (
    <ExecutionEngineContext.Provider
      value={{
        status,
        error,
        connectedMt5,
        engine,
        system,
        config,
        trades,
        riskGuards,
        clusterRisk,
        metrics,
        events,
        logs,
        lastMetricsAt,
        isStale,
      }}
    >
      {children}
    </ExecutionEngineContext.Provider>
  );
}

export const useExecutionEngine = () => useContext(ExecutionEngineContext);
