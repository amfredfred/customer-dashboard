"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./auth-provider";

type GatewayStatus = "disconnected" | "connecting" | "authenticated" | "rejected";
export type SignalMetricsSnapshot = {
  observed_at?: number;
  system?: { uptime_ms?: number; uptime_s?: number; memory_mb?: number };
  metrics?: Record<string, number | Record<string, number>>;
  latency?: Record<string, number>;
  scheduler?: Record<string, unknown>[];
  active_signals?: Record<string, unknown>[];
  api?: { calls_last_min?: number; by_source?: Record<string, unknown> };
};
export type ExecutionMetricsSnapshot = {
  connected?: boolean;
  engine?: Record<string, unknown>;
  trades?: Record<string, unknown>[];
  riskGuards?: Record<string, unknown>[];
  metrics?: Record<string, unknown>;
  signals?: Record<string, unknown>[];
};
type GatewayValue = {
  status: GatewayStatus;
  error: string | null;
  signalMetrics: SignalMetricsSnapshot | null;
  setSignalMetricsSubscribed: (subscribed: boolean) => void;
  executionMetrics: ExecutionMetricsSnapshot | null;
  executionMetricsError: string | null;
  setExecutionMetricsEngine: (engineId: string | null) => void;
};

const GatewayContext = createContext<GatewayValue>({
  status: "disconnected",
  error: null,
  signalMetrics: null,
  setSignalMetricsSubscribed: () => undefined,
  executionMetrics: null,
  executionMetricsError: null,
  setExecutionMetricsEngine: () => undefined,
});

export function GatewayProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [status, setStatus] = useState<GatewayStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [signalMetrics, setSignalMetrics] = useState<SignalMetricsSnapshot | null>(null);
  const [executionMetrics, setExecutionMetrics] = useState<ExecutionMetricsSnapshot | null>(null);
  const [executionMetricsError, setExecutionMetricsError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const signalMetricsDesired = useRef(false);
  const executionEngineDesired = useRef<string | null>(null);

  const setSignalMetricsSubscribed = useCallback((subscribed: boolean) => {
    signalMetricsDesired.current = subscribed;
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({
      event: subscribed ? "signal.metrics.subscribe" : "signal.metrics.unsubscribe",
      data: {},
    }));
  }, []);

  const setExecutionMetricsEngine = useCallback((engineId: string | null) => {
    const previous = executionEngineDesired.current;
    executionEngineDesired.current = engineId;
    setExecutionMetricsError(null);
    if (!engineId) setExecutionMetrics(null);
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (previous && previous !== engineId) {
      socket.send(JSON.stringify({ event: "execution.metrics.unsubscribe", data: {} }));
    }
    if (engineId) {
      socket.send(JSON.stringify({ event: "execution.metrics.subscribe", data: { engine_id: engineId } }));
    }
  }, []);

  useEffect(() => {
    const accessToken = session?.access_token;
    if (!accessToken) return;

    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let socket: WebSocket | null = null;
    const url =
      process.env.NEXT_PUBLIC_GATEWAY_WS_URL ?? "ws://localhost:4000/dashboard";

    function connect() {
      if (stopped) return;
      setStatus("connecting");
      setError(null);
      socket = new WebSocket(url);
      socketRef.current = socket;
      socket.onopen = () => {
        socket?.send(JSON.stringify({
          event: "dashboard.authenticate",
          data: { access_token: accessToken },
        }));
      };
      socket.onmessage = event => {
        try {
          const message = JSON.parse(String(event.data)) as {
            event?: string;
            data?: SignalMetricsSnapshot & { reason?: string };
          };
          if (message.event === "dashboard.authenticated") {
            setStatus("authenticated");
            if (signalMetricsDesired.current) {
              socket?.send(JSON.stringify({ event: "signal.metrics.subscribe", data: {} }));
            }
            if (executionEngineDesired.current) {
              socket?.send(JSON.stringify({
                event: "execution.metrics.subscribe",
                data: { engine_id: executionEngineDesired.current },
              }));
            }
          } else if (message.event === "signal.metrics.snapshot") {
            setSignalMetrics(message.data as SignalMetricsSnapshot);
          } else if (message.event === "execution.metrics.snapshot") {
            const payload = message.data as unknown as { snapshot?: ExecutionMetricsSnapshot };
            setExecutionMetrics(payload.snapshot ?? null);
            setExecutionMetricsError(null);
          } else if (message.event === "engine.offline") {
            setExecutionMetrics(null);
            setExecutionMetricsError(null);
          } else if (message.event === "execution.metrics.forbidden") {
            setExecutionMetricsError(message.data?.reason ?? "Execution metrics access denied");
          } else if (
            message.event === "dashboard.authentication_failed" ||
            message.event === "dashboard.authentication_required"
          ) {
            setStatus("rejected");
            setError(message.data?.reason ?? "Gateway authentication rejected");
          }
        } catch {
          setError("Gateway returned an invalid message");
        }
      };
      socket.onerror = () => setError("Cannot reach Apex Quant Trader Gateway");
      socket.onclose = event => {
        socket = null;
        socketRef.current = null;
        if (stopped) return;
        if (event.code === 1008) {
          setStatus("rejected");
          setError("Gateway rejected the dashboard session");
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
      socketRef.current = null;
    };
  }, [session?.access_token]);

  return (
    <GatewayContext.Provider value={{
      status,
      error,
      signalMetrics,
      setSignalMetricsSubscribed,
      executionMetrics,
      executionMetricsError,
      setExecutionMetricsEngine,
    }}>
      {children}
    </GatewayContext.Provider>
  );
}

export const useGateway = () => useContext(GatewayContext);
