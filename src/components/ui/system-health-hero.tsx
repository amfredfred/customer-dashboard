import { Radio, Cpu, Link2, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { StatusBadge } from "./status-badge";
import type { AggregateHealth, DomainHealth, HealthState } from "@/lib/system-health";
import { healthToStatusKind } from "@/lib/system-health";

const HEADLINE_DOT: Record<HealthState, string> = {
  healthy: "dot-live", active: "dot-live", waiting: "dot-warn pulse",
  degraded: "dot-warn pulse", stale: "dot-warn pulse", offline: "dot-dead", error: "dot-dead",
};

function relativeAge(at: number | null): string {
  if (at === null) return "never";
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.round(seconds / 60);
  return `${mins}m ago`;
}

function HealthCard({
  icon: Icon, label, health, extra,
}: {
  icon: LucideIcon;
  label: string;
  health: DomainHealth;
  extra?: string;
}) {
  return (
    <div className="health-card">
      <div className="health-card-icon">
        <Icon size={16} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="health-card-label">{label}</div>
        <div className="mt-1.5">
          <StatusBadge kind={healthToStatusKind(health.state)} label={health.label} />
        </div>
        <div className="health-card-detail">{extra ?? health.detail}</div>
      </div>
    </div>
  );
}

/**
 * The Overview's primary "is everything working?" surface: one aggregate
 * headline plus the four domain cards the brief calls for (Signal Engine,
 * Execution Engine, Connectivity, Data Freshness). Every value here is
 * derived from data the providers already expose - see src/lib/system-health.ts.
 */
export function SystemHealthHero({
  aggregate, signal, execution, signalLastAt, executionLastAt,
}: {
  aggregate: AggregateHealth;
  signal: DomainHealth;
  execution: DomainHealth;
  signalLastAt: number | null;
  executionLastAt: number | null;
}) {
  const freshestAt =
    signalLastAt === null ? executionLastAt
    : executionLastAt === null ? signalLastAt
    : Math.max(signalLastAt, executionLastAt);

  const connectivityHealth: DomainHealth =
    aggregate.state === "offline" || aggregate.state === "error"
      ? { state: aggregate.state, label: "Interrupted", detail: "One or more hub connections are down" }
      : aggregate.state === "waiting"
      ? { state: "waiting", label: "Connecting", detail: "Establishing hub connections" }
      : { state: "healthy", label: "Connected", detail: "Both hub connections are open" };

  const freshnessHealth: DomainHealth =
    freshestAt === null
      ? { state: "waiting", label: "No data yet", detail: "Awaiting first telemetry" }
      : aggregate.state === "stale"
      ? { state: "stale", label: "Delayed", detail: `Last update ${relativeAge(freshestAt)}` }
      : { state: "healthy", label: "Up to date", detail: `Last update ${relativeAge(freshestAt)}` };

  return (
    <section className="health-hero">
      <div className="health-hero-headline">
        <span className={`dot ${HEADLINE_DOT[aggregate.state]}`} style={{ width: 10, height: 10 }} />
        <div>
          <div className="health-hero-title">{aggregate.headline}</div>
          <div className="health-hero-subtitle">{aggregate.detail}</div>
        </div>
      </div>
      <div className="health-hero-grid">
        <HealthCard icon={Radio} label="Signal Engine" health={signal} />
        <HealthCard icon={Cpu} label="Execution Engine" health={execution} />
        <HealthCard icon={Link2} label="Connectivity" health={connectivityHealth} />
        <HealthCard icon={Clock} label="Data Freshness" health={freshnessHealth} />
      </div>
    </section>
  );
}
