import type { SignalConnectionStatus, BrokerSnapshot, SignalEventEntry } from "@/components/signal-engine-provider";
import type { ExecutionConnectionStatus, ExecutionBrokerState, ExecutionEventEntry } from "@/components/execution-engine-provider";
import type { FeedTone } from "@/components/ui/event-feed";

/** Shared customer-facing state vocabulary (brief §16) - every domain
 *  health computation and every status surface in the app maps onto this. */
export type HealthState = "healthy" | "active" | "degraded" | "waiting" | "offline" | "error" | "stale";

export interface DomainHealth {
  state: HealthState;
  /** Short customer-facing label, e.g. "Connected", "Degraded", "Offline". */
  label: string;
  /** One-line context, e.g. "2/3 brokers live" or "Waiting for a terminal to connect". */
  detail?: string;
}

const HEALTH_RANK: Record<HealthState, number> = {
  error: 0,
  offline: 1,
  degraded: 2,
  stale: 3,
  waiting: 4,
  active: 5,
  healthy: 5,
};

/** Derives Signal Engine domain health purely from fields the provider already exposes. */
export function signalDomainHealth(params: {
  status: SignalConnectionStatus;
  error: string | null;
  brokers: string[];
  byBroker: Record<string, BrokerSnapshot>;
  isStale: boolean;
}): DomainHealth {
  const { status, error, brokers, byBroker, isStale } = params;

  if (status === "error") {
    return { state: "error", label: "Error", detail: error ?? "Connection rejected" };
  }
  if (status === "disconnected") {
    return { state: "offline", label: "Offline", detail: "Not connected to the signal hub" };
  }
  if (status === "connecting") {
    return { state: "waiting", label: "Connecting", detail: "Opening connection to the signal hub" };
  }
  // connected
  if (brokers.length === 0) {
    return { state: "waiting", label: "Waiting", detail: "Connected - waiting for a terminal to connect" };
  }
  if (isStale) {
    return { state: "stale", label: "Stale", detail: "Connected, but data hasn't refreshed recently" };
  }
  const liveCount = brokers.filter(b => byBroker[b]?.live).length;
  if (liveCount === 0) {
    return { state: "degraded", label: "Degraded", detail: "No terminals currently live" };
  }
  if (liveCount < brokers.length) {
    return { state: "degraded", label: "Degraded", detail: `${liveCount}/${brokers.length} terminals live` };
  }
  return { state: "active", label: "Active", detail: `${liveCount}/${brokers.length} terminals live` };
}

/** Derives Execution Engine domain health purely from fields the provider already exposes. */
export function executionDomainHealth(params: {
  status: ExecutionConnectionStatus;
  error: string | null;
  brokers: string[];
  byBroker: Record<string, ExecutionBrokerState>;
}): DomainHealth {
  const { status, error, brokers, byBroker } = params;

  if (status === "error") {
    return { state: "error", label: "Error", detail: error ?? "Connection rejected" };
  }
  if (status === "disconnected") {
    return { state: "offline", label: "Offline", detail: "Not connected to the execution hub" };
  }
  if (status === "connecting") {
    return { state: "waiting", label: "Connecting", detail: "Opening connection to the execution hub" };
  }
  // connected
  if (brokers.length === 0) {
    return { state: "waiting", label: "Waiting", detail: "Connected - waiting for an engine instance" };
  }
  const anyStale = brokers.some(b => byBroker[b]?.isStale);
  if (anyStale) {
    return { state: "stale", label: "Stale", detail: "Connected, but data hasn't refreshed recently" };
  }
  const liveCount = brokers.filter(b => byBroker[b]?.live).length;
  if (liveCount === 0) {
    return { state: "degraded", label: "Degraded", detail: "No engine instances currently live" };
  }
  if (liveCount < brokers.length) {
    return { state: "degraded", label: "Degraded", detail: `${liveCount}/${brokers.length} instances live` };
  }
  return { state: "active", label: "Active", detail: `${liveCount}/${brokers.length} instances live` };
}

/** StatusBadge doesn't have a distinct "stale" kind - map it onto the
 *  closest existing visual treatment (amber, like "warning"). */
export function healthToStatusKind(state: HealthState): "healthy" | "active" | "degraded" | "waiting" | "offline" | "error" | "warning" {
  return state === "stale" ? "warning" : state;
}

export interface AggregateHealth {
  state: HealthState;
  headline: string;
  detail: string;
}

/** Combines both domains into the Overview's single headline status. */
export function aggregateSystemHealth(signal: DomainHealth, execution: DomainHealth): AggregateHealth {
  const worst = HEALTH_RANK[signal.state] <= HEALTH_RANK[execution.state] ? signal : execution;

  if (worst.state === "error" || worst.state === "offline") {
    return { state: worst.state, headline: "Action Required", detail: worst.detail ?? worst.label };
  }
  if (worst.state === "degraded" || worst.state === "stale") {
    return { state: worst.state, headline: "System Degraded", detail: worst.detail ?? worst.label };
  }
  if (worst.state === "waiting") {
    return { state: "waiting", headline: "Waiting", detail: worst.detail ?? worst.label };
  }
  return { state: "healthy", headline: "System Operational", detail: "Signal and execution engines are healthy" };
}

/* ── Unified activity feed ──────────────────────────────────────────────── */

export type ActivityDomain = "signal" | "execution";

export interface UnifiedActivityEntry {
  id: string;
  ts: string;
  /** Epoch ms, used for sorting - parsed once from `ts`. */
  atMs: number;
  domain: ActivityDomain;
  eventType: string;
  summary: string;
  severity: FeedTone;
  broker?: string;
  raw: Record<string, unknown>;
}

const REJECTION_TYPES = new Set([
  "strategy.rejected", "signal.rejected", "risk.rejected",
  "parity.warning", "signal.filtered", "trade.error",
]);
const SUCCESS_TYPES = new Set([
  "trade.opened", "trade.closed", "trade.tp1_hit", "trade.tp2_hit", "trade.sl_hit",
  "order.filled", "position.partial_tp", "risk.approved", "engine.resumed",
]);
const WARNING_HINTS = ["reject", "invalid", "stale", "blocked", "filtered", "paused"];

/** Shared severity classifier - the single source of truth for how an event
 *  type maps onto a customer-facing tone, reused by the Activity page and
 *  by both engine pages' consolidated Activity tabs. */
export function classifySeverity(eventType: string): FeedTone {
  const t = eventType.toLowerCase();
  if (REJECTION_TYPES.has(eventType) || t.includes("error")) return "danger";
  if (SUCCESS_TYPES.has(eventType)) return "success";
  if (WARNING_HINTS.some(h => t.includes(h))) return "warning";
  if (t.startsWith("signal.") || t.startsWith("trade.")) return "info";
  return "neutral";
}

function parseTs(ts: string): number {
  const d = new Date(ts);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

/** Merges the signal engine's event stream with every execution broker's
 *  event stream into one time-sorted, severity-classified feed. Both
 *  streams already exist on their providers - this only merges and sorts. */
export function unifiedActivityFeed(
  signalEvents: SignalEventEntry[],
  executionByBroker: Record<string, ExecutionBrokerState>,
  maxEntries = 500,
): UnifiedActivityEntry[] {
  const entries: UnifiedActivityEntry[] = [];

  // Index is folded into the id because upstream event ids aren't always
  // unique within a single broker's stream (e.g. a signal that transitions
  // RECEIVED -> TRIGGERED can be reported under the same underlying id) -
  // this feed must never hand React a colliding key regardless.
  signalEvents.forEach((ev, i) => {
    entries.push({
      id: `signal:${ev.broker}:${ev.event_type}:${ev.id}:${i}`,
      ts: ev.ts,
      atMs: parseTs(ev.ts),
      domain: "signal",
      eventType: ev.event_type,
      summary: ev.summary,
      severity: classifySeverity(ev.event_type),
      broker: ev.broker,
      raw: ev.data,
    });
  });

  for (const [broker, state] of Object.entries(executionByBroker)) {
    (state.events as ExecutionEventEntry[]).forEach((ev, i) => {
      entries.push({
        id: `execution:${broker}:${ev.event_type}:${ev.id}:${i}`,
        ts: ev.ts,
        atMs: parseTs(ev.ts),
        domain: "execution",
        eventType: ev.event_type,
        summary: ev.summary,
        severity: classifySeverity(ev.event_type),
        broker,
        raw: ev.data,
      });
    });
  }

  entries.sort((a, b) => b.atMs - a.atMs);
  return entries.slice(0, maxEntries);
}
