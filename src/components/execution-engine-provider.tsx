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

/** One execution-engine instance's state, as relayed through the hub
 *  (see execution-engine's src/hub) — one WebSocket connection to the hub
 *  carries every connected broker's telemetry, each frame tagged with
 *  `broker`, same shape/mental-model as the signal-engine hub's byBroker. */
export type ExecutionBrokerState = {
  live: boolean;
  connectedMt5: boolean;
  autotradingEnabled: boolean | null;
  signalEngineConnected: boolean;
  engine: Record<string, unknown> | null;
  system: Record<string, unknown> | null;
  config: Record<string, unknown> | null;
  trades: Record<string, unknown>[];
  riskGuards: Record<string, unknown>[];
  pressure: Record<string, unknown>[];
  clusterRisk: Record<string, unknown> | null;
  metrics: Record<string, unknown> | null;
  events: ExecutionEventEntry[];
  logs: LogLine[];
  lastMetricsAt: number | null;
  /** True once this broker hasn't been heard from for longer than STALE_MS. */
  isStale: boolean;
};

type ExecutionValue = {
  /** Connection status of the single hub connection, not any one broker. */
  status: ExecutionConnectionStatus;
  error: string | null;
  byBroker: Record<string, ExecutionBrokerState>;
  brokers: string[];
  /** Routes a command (close_trade/pause/resume) to a specific broker's
   *  instance via the hub — no-op if the hub connection is down. */
  sendCommand: (broker: string, type: string, payload?: Record<string, unknown>) => void;
};

const DEFAULT_BROKER_STATE: ExecutionBrokerState = {
  live: true,
  connectedMt5: false,
  autotradingEnabled: null,
  signalEngineConnected: false,
  engine: null,
  system: null,
  config: null,
  trades: [],
  riskGuards: [],
  pressure: [],
  clusterRisk: null,
  metrics: null,
  events: [],
  logs: [],
  lastMetricsAt: null,
  isStale: false,
};

const ExecutionEngineContext = createContext<ExecutionValue>({
  status: "disconnected",
  error: null,
  byBroker: {},
  brokers: [],
  sendCommand: () => {},
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

/** payload.autotrading_enabled is a nullable bool from the engine - null/undefined means unknown. */
function parseTristate(value: unknown): boolean | null {
  return value === null || value === undefined ? null : Boolean(value);
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
  const [byBroker, setByBroker] = useState<Record<string, ExecutionBrokerState>>({});
  const socketRef = useRef<WebSocket | null>(null);
  const lastMetricsAtRefs = useRef<Record<string, number | null>>({});

  const patch = (broker: string, p: Partial<ExecutionBrokerState>) => {
    setByBroker(prev => ({
      ...prev,
      [broker]: { ...(prev[broker] ?? DEFAULT_BROKER_STATE), ...p },
    }));
  };
  const pushEvent = (broker: string, entry: ExecutionEventEntry) => {
    setByBroker(prev => {
      const cur = prev[broker] ?? DEFAULT_BROKER_STATE;
      if (cur.events.some(e => e.id === entry.id)) return prev;
      return { ...prev, [broker]: { ...cur, events: [entry, ...cur.events].slice(0, MAX_EVENTS) } };
    });
  };

  /* Staleness is time-based, not just message-based - re-check on an interval
     so the warning appears even if no new message ever arrives again. */
  useEffect(() => {
    const timer = setInterval(() => {
      setByBroker(prev => {
        let changed = false;
        const next = { ...prev };
        for (const broker of Object.keys(next)) {
          const last = lastMetricsAtRefs.current[broker];
          const stale = last !== null && Date.now() - (last ?? 0) > STALE_MS;
          if (next[broker].isStale !== stale) {
            next[broker] = { ...next[broker], isStale: stale };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, STALE_CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let socket: WebSocket | null = null;

    const url = process.env.NEXT_PUBLIC_EXECUTION_ENGINE_WS_URL ?? "ws://localhost:8080";

    function markFresh(broker: string) {
      const now = Date.now();
      lastMetricsAtRefs.current[broker] = now;
      patch(broker, { lastMetricsAt: now, isStale: false, live: true });
    }

    function connect() {
      if (stopped) return;
      setStatus("connecting");
      setError(null);
      socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => setStatus("connected");

      socket.onmessage = ev => {
        try {
          const message = JSON.parse(String(ev.data)) as {
            type?: string;
            payload?: unknown;
            broker?: string;
          };
          const type = message.type ?? "";
          const payload = (message.payload ?? {}) as Record<string, unknown>;
          const broker = message.broker ?? "";
          if (!broker) return;  // hub always stamps this; ignore anything that somehow doesn't have it

          if (type === "STATE_SNAPSHOT") {
            const initialSignals = Array.isArray(payload.signals)
              ? (payload.signals as Record<string, unknown>[])
              : [];
            patch(broker, {
              connectedMt5: Boolean(payload.connected),
              autotradingEnabled: parseTristate(payload.autotrading_enabled),
              signalEngineConnected: Boolean(payload.signal_engine_connected),
              engine: (payload.engine as Record<string, unknown>) ?? null,
              system: (payload.system as Record<string, unknown>) ?? null,
              config: (payload.config as Record<string, unknown>) ?? null,
              trades: Array.isArray(payload.trades) ? (payload.trades as Record<string, unknown>[]) : [],
              riskGuards: Array.isArray(payload.riskGuards) ? (payload.riskGuards as Record<string, unknown>[]) : [],
              pressure: Array.isArray(payload.pressure) ? (payload.pressure as Record<string, unknown>[]) : [],
              clusterRisk: (payload.clusterRisk as Record<string, unknown>) ?? null,
              metrics: (payload.metrics as Record<string, unknown>) ?? null,
              logs: Array.isArray(payload.logs) ? (payload.logs as LogLine[]) : [],
              events: initialSignals.map(sigToEvent).slice(0, MAX_EVENTS),
            });
            markFresh(broker);
            return;
          }

          if (type === "METRICS_UPDATE") {
            const p: Partial<ExecutionBrokerState> = { metrics: payload };
            if ("connected" in payload) p.connectedMt5 = Boolean(payload.connected);
            if ("autotrading_enabled" in payload) p.autotradingEnabled = parseTristate(payload.autotrading_enabled);
            if ("signal_engine_connected" in payload) p.signalEngineConnected = Boolean(payload.signal_engine_connected);
            if (Array.isArray(payload.riskGuards)) p.riskGuards = payload.riskGuards as Record<string, unknown>[];
            if (Array.isArray(payload.pressure)) p.pressure = payload.pressure as Record<string, unknown>[];
            if (Array.isArray(payload.trades)) p.trades = payload.trades as Record<string, unknown>[];
            patch(broker, p);
            markFresh(broker);
            return;
          }

          if (type === "trade.opened") {
            const id = payload.id;
            setByBroker(prev => {
              const cur = prev[broker] ?? DEFAULT_BROKER_STATE;
              const trades = id ? [payload, ...cur.trades.filter(t => t.id !== id)] : [payload, ...cur.trades];
              return { ...prev, [broker]: { ...cur, trades } };
            });
            pushEvent(broker, {
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
            setByBroker(prev => {
              const cur = prev[broker] ?? DEFAULT_BROKER_STATE;
              return { ...prev, [broker]: { ...cur, trades: cur.trades.filter(t => t.id !== tradeId) } };
            });
            pushEvent(broker, {
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
            pushEvent(broker, {
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
            pushEvent(broker, sigToEvent(payload));
            return;
          }

          if (type === "engine.paused" || type === "engine.resumed") {
            setByBroker(prev => {
              const cur = prev[broker] ?? DEFAULT_BROKER_STATE;
              return {
                ...prev,
                [broker]: {
                  ...cur,
                  engine: {
                    ...(cur.engine ?? {}),
                    is_paused: type === "engine.paused",
                    status: type === "engine.paused" ? "PAUSED" : "RUNNING",
                  },
                },
              };
            });
            return;
          }
        } catch {
          setError("Execution hub returned an invalid message");
        }
      };

      socket.onerror = () => setError("Cannot reach the execution hub");
      socket.onclose = () => {
        socket = null;
        socketRef.current = null;
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

  const sendCommand = (broker: string, type: string, cmdPayload: Record<string, unknown> = {}) => {
    socketRef.current?.send(JSON.stringify({ type, payload: cmdPayload, broker }));
  };

  const brokers = Object.keys(byBroker).sort();

  return (
    <ExecutionEngineContext.Provider value={{ status, error, byBroker, brokers, sendCommand }}>
      {children}
    </ExecutionEngineContext.Provider>
  );
}

export const useExecutionEngine = () => useContext(ExecutionEngineContext);
