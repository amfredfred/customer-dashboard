"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./auth-provider";

type GatewayStatus = "disconnected" | "connecting" | "authenticated" | "rejected";

export type EngineHealthState = "online" | "stale" | "offline" | "error" | "unknown";

export type EngineRegistryEntry = {
  sourceKey: string;
  connectedAt: string | null;
  lastSeenAt: string | null;
  lastMetricsAt: string | null;
  lastAwarenessAt: string | null;
  healthState: EngineHealthState;
  latestMetrics: unknown | null;
  latestAwareness: Record<string, unknown> | null;
  lastError: string | null;
  account: { login: string; server: string; mode: "demo" | "live" } | null;
  deviceName: string | null;
  engineVersion: string | null;
};

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
  engineRegistry: EngineRegistryEntry[];
  selectedSourceKey: string | null;
  setSelectedSourceKey: (key: string | null) => void;
};

const GatewayContext = createContext<GatewayValue>({
  status: "disconnected",
  error: null,
  signalMetrics: null,
  setSignalMetricsSubscribed: () => undefined,
  executionMetrics: null,
  executionMetricsError: null,
  setExecutionMetricsEngine: () => undefined,
  engineRegistry: [],
  selectedSourceKey: null,
  setSelectedSourceKey: () => undefined,
});

export function GatewayProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [status, setStatus] = useState<GatewayStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [signalMetrics, setSignalMetrics] = useState<SignalMetricsSnapshot | null>(null);
  const [executionMetrics, setExecutionMetrics] = useState<ExecutionMetricsSnapshot | null>(null);
  const [executionMetricsError, setExecutionMetricsError] = useState<string | null>(null);
  const [engineRegistry, setEngineRegistry] = useState<EngineRegistryEntry[]>([]);
  const [selectedSourceKey, setSelectedSourceKey] = useState<string | null>(null);
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

  // Merge a single updated entry into the local registry state.
  const mergeEntry = useCallback((updated: EngineRegistryEntry) => {
    setEngineRegistry(prev => {
      const idx = prev.findIndex(e => e.sourceKey === updated.sourceKey);
      if (idx === -1) return [...prev, updated];
      const next = [...prev];
      next[idx] = { ...next[idx], ...updated };
      return next;
    });
  }, []);

  useEffect(() => {
    const accessToken = session?.access_token;
    if (!accessToken) return;

    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let socket: WebSocket | null = null;
    const url =
      process.env.NEXT_PUBLIC_GATEWAY_WS_URL ?? "wss://apex-gateway.somicast.com/dashboard";

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
            data?: Record<string, unknown>;
          };
          const ev = message.event ?? "";
          const data = message.data ?? {};

          if (ev === "dashboard.authenticated") {
            setStatus("authenticated");
            // Re-subscribe to pending interests.
            if (signalMetricsDesired.current) {
              socket?.send(JSON.stringify({ event: "signal.metrics.subscribe", data: {} }));
            }
            if (executionEngineDesired.current) {
              socket?.send(JSON.stringify({
                event: "execution.metrics.subscribe",
                data: { engine_id: executionEngineDesired.current },
              }));
            }
            // Request the full engine registry snapshot.
            socket?.send(JSON.stringify({ event: "gateway.engines.snapshot", data: {} }));

          } else if (ev === "signal.metrics.snapshot") {
            setSignalMetrics(data as SignalMetricsSnapshot);

          } else if (ev === "execution.metrics.snapshot") {
            const payload = data as { snapshot?: ExecutionMetricsSnapshot };
            setExecutionMetrics(payload.snapshot ?? null);
            setExecutionMetricsError(null);

          } else if (ev === "engine.offline") {
            const engineId = String(data.engine_id ?? "");
            setExecutionMetrics(null);
            setExecutionMetricsError(null);
            if (engineId) {
              setEngineRegistry(prev =>
                prev.map(e =>
                  e.sourceKey === engineId ? { ...e, healthState: "offline" } : e,
                ),
              );
            }

          } else if (ev === "execution.metrics.forbidden") {
            setExecutionMetricsError(String(data.reason ?? "Execution metrics access denied"));

          } else if (ev === "gateway.engines.snapshot") {
            const engines = data.engines;
            if (Array.isArray(engines)) {
              setEngineRegistry(engines as EngineRegistryEntry[]);
            }

          } else if (ev === "engine.awareness") {
            const engineId = String(data.engine_id ?? "");
            const awareness = (data.awareness ?? {}) as Record<string, unknown>;
            if (engineId) {
              setEngineRegistry(prev =>
                prev.map(e =>
                  e.sourceKey === engineId
                    ? { ...e, latestAwareness: awareness, lastAwarenessAt: String(data.ts ?? new Date().toISOString()) }
                    : e,
                ),
              );
            }

          } else if (ev === "engine.health_changed") {
            const engineId = String(data.engine_id ?? "");
            const healthState = String(data.health_state ?? "unknown") as EngineHealthState;
            if (engineId) {
              setEngineRegistry(prev =>
                prev.map(e =>
                  e.sourceKey === engineId ? { ...e, healthState } : e,
                ),
              );
            }

          } else if (
            ev === "dashboard.authentication_failed" ||
            ev === "dashboard.authentication_required"
          ) {
            setStatus("rejected");
            setError(String(data.reason ?? "Gateway authentication rejected"));
          }
        } catch {
          setError("Gateway returned an invalid message");
        }
      };
      socket.onerror = () => setError("Cannot reach Apex Quantel Gateway");
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
  }, [session?.access_token, mergeEntry]);

  return (
    <GatewayContext.Provider value={{
      status,
      error,
      signalMetrics,
      setSignalMetricsSubscribed,
      executionMetrics,
      executionMetricsError,
      setExecutionMetricsEngine,
      engineRegistry,
      selectedSourceKey,
      setSelectedSourceKey,
    }}>
      {children}
    </GatewayContext.Provider>
  );
}

export const useGateway = () => useContext(GatewayContext);
