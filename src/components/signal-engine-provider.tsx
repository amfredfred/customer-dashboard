"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

export type SignalConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export type SignalEventEntry = {
  id: string;
  event_type: string;
  ts: string;
  summary: string;
  data: Record<string, unknown>;
};

type SignalValue = {
  status: SignalConnectionStatus;
  error: string | null;
  metrics: Record<string, unknown> | null;
  recentEvents: SignalEventEntry[];
  supportedSymbols: string[];
  lastMetricsAt: number | null;
  /** True once metrics.snapshot hasn't arrived for longer than STALE_MS, while still connected. */
  isStale: boolean;
};

const SignalEngineContext = createContext<SignalValue>({
  status: "disconnected",
  error: null,
  metrics: null,
  recentEvents: [],
  supportedSymbols: [],
  lastMetricsAt: null,
  isStale: false,
});

const MAX_EVENTS = 500;
/** Signal-engine pushes metrics.snapshot every 5s (server.py's _METRICS_INTERVAL_S) - 4x that is a safe stale threshold. */
const STALE_MS = 20_000;
const STALE_CHECK_INTERVAL_MS = 2_000;

function summarize(event: string, payload: Record<string, unknown>): string {
  if (event === "signal.triggered") {
    const symbol = payload.symbol ?? "?";
    const direction = payload.direction ?? payload.side ?? "";
    return `${symbol} ${direction}`.trim();
  }
  return String(payload.reason ?? payload.message ?? event);
}

export function SignalEngineProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SignalConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);
  const [recentEvents, setRecentEvents] = useState<SignalEventEntry[]>([]);
  const [supportedSymbols, setSupportedSymbols] = useState<string[]>([]);
  const [lastMetricsAt, setLastMetricsAt] = useState<number | null>(null);
  const [isStale, setIsStale] = useState(false);
  const counterRef = useRef(0);
  const lastMetricsAtRef = useRef<number | null>(null);

  /* Staleness is time-based, not just message-based - re-check on an interval
     so the banner appears even if no new message ever arrives again. */
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

    const base = process.env.NEXT_PUBLIC_SIGNAL_ENGINE_WS_URL ?? "ws://localhost:8765";
    const token = process.env.NEXT_PUBLIC_SIGNAL_ENGINE_TOKEN;
    const url = token ? `${base}?token=${encodeURIComponent(token)}` : base;

    function connect() {
      if (stopped) return;
      setStatus("connecting");
      setError(null);
      socket = new WebSocket(url);

      socket.onmessage = ev => {
        try {
          const message = JSON.parse(String(ev.data)) as {
            event?: string;
            payload?: Record<string, unknown>;
          };
          const event = message.event ?? "";
          const payload = message.payload ?? {};

          if (event === "connected") {
            setStatus("connected");
            const symbols = Array.isArray(payload.supported_symbols)
              ? (payload.supported_symbols as string[])
              : [];
            setSupportedSymbols(symbols);
            socket?.send(JSON.stringify({ action: "subscribe", symbols }));
            socket?.send(JSON.stringify({ action: "subscribe_metrics" }));
            return;
          }

          if (event === "metrics.snapshot") {
            setMetrics(payload);
            lastMetricsAtRef.current = Date.now();
            setLastMetricsAt(lastMetricsAtRef.current);
            setIsStale(false);
            return;
          }

          if (event === "subscribed" || event === "unsubscribed" || event === "metrics_subscribed") {
            return;
          }

          // Every other event (signal.triggered, rejections, lifecycle, etc.)
          // is treated as a log/event entry — the exact set of event names is
          // whatever the signal engine's EventGateway forwards.
          const id = String(
            payload.id ?? payload.signal_id ?? `${event}:${Date.now()}:${counterRef.current++}`,
          );
          const entry: SignalEventEntry = {
            id,
            event_type: event,
            ts: new Date().toISOString(),
            summary: summarize(event, payload),
            data: payload,
          };
          setRecentEvents(prev => {
            if (prev.some(e => e.id === id)) return prev;
            return [entry, ...prev].slice(0, MAX_EVENTS);
          });
        } catch {
          setError("Signal engine returned an invalid message");
        }
      };

      socket.onerror = () => setError("Cannot reach signal engine");
      socket.onclose = closeEvent => {
        socket = null;
        if (stopped) return;
        if (closeEvent.code === 1008) {
          setStatus("error");
          setError("Signal engine rejected the connection (bad token)");
          return;
        }
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
    <SignalEngineContext.Provider
      value={{ status, error, metrics, recentEvents, supportedSymbols, lastMetricsAt, isStale }}
    >
      {children}
    </SignalEngineContext.Provider>
  );
}

export const useSignalEngine = () => useContext(SignalEngineContext);
