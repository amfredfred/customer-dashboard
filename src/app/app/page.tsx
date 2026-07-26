"use client";

import Link from "next/link";
import { Radio, Cpu, Building2, ListTree, ArrowRight } from "lucide-react";
import { useSignalEngine } from "@/components/signal-engine-provider";
import { useExecutionEngine } from "@/components/execution-engine-provider";
import { PageHeader, SectionHead } from "@/components/metric-detail";
import { SystemHealthHero } from "@/components/ui/system-health-hero";
import { OperationalFlow, type FlowStepDef } from "@/components/ui/operational-flow";
import { ActivityTimeline } from "@/components/ui/activity-timeline";
import { MetricCard } from "@/components/ui/metric-card";
import { SurfaceSection } from "@/components/ui/surface";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  aggregateSystemHealth, executionDomainHealth, healthToStatusKind,
  signalDomainHealth, unifiedActivityFeed,
} from "@/lib/system-health";

function isN(v: unknown): v is number { return typeof v === "number" && !isNaN(v); }

function relativeAge(ts: string | number | null): string {
  if (ts === null) return "never";
  const at = typeof ts === "number" ? ts : new Date(ts).getTime();
  if (isNaN(at)) return "never";
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  return `${hours}h ago`;
}

export default function Overview() {
  const signalEngine = useSignalEngine();
  const executionEngine = useExecutionEngine();

  const signalHealth = signalDomainHealth({
    status: signalEngine.status, error: signalEngine.error,
    brokers: signalEngine.brokers, byBroker: signalEngine.byBroker, isStale: signalEngine.isStale,
  });
  const executionHealth = executionDomainHealth({
    status: executionEngine.status, error: executionEngine.error,
    brokers: executionEngine.brokers, byBroker: executionEngine.byBroker,
  });
  const aggregate = aggregateSystemHealth(signalHealth, executionHealth);

  const execBrokerStates = Object.values(executionEngine.byBroker);
  const anyMt5Connected = execBrokerStates.some(b => b.connectedMt5);
  const anyExecLive = execBrokerStates.some(b => b.live);
  const brokerStepState =
    executionEngine.brokers.length === 0 ? executionHealth.state
    : anyMt5Connected ? "active"
    : anyExecLive ? "degraded"
    : "offline";
  const brokerStepDetail =
    executionEngine.brokers.length === 0
      ? "No broker terminals reporting yet"
      : `${execBrokerStates.filter(b => b.connectedMt5).length}/${execBrokerStates.length} broker connections live`;

  const feed = unifiedActivityFeed(signalEngine.recentEvents, executionEngine.byBroker, 8);
  const mostRecentAt = feed[0]?.atMs ?? null;
  const activityStepState = mostRecentAt === null ? "waiting" : "active";

  const flowSteps: FlowStepDef[] = [
    { icon: Radio, label: "Signal Engine", state: signalHealth.state, detail: signalHealth.detail ?? signalHealth.label },
    { icon: Cpu, label: "Execution Engine", state: executionHealth.state, detail: executionHealth.detail ?? executionHealth.label },
    { icon: Building2, label: "Broker / Account", state: brokerStepState, detail: brokerStepDetail },
    { icon: ListTree, label: "Activity", state: activityStepState, detail: mostRecentAt ? `Last event ${relativeAge(mostRecentAt)}` : "No activity recorded yet" },
  ];

  // Contextual, translated metrics (brief §6) - pulled from whichever
  // broker each provider already treats as "primary" (first live, else
  // first known), same convention the shell's footer uses.
  const signalBrokers = signalEngine.brokers;
  const primarySignalBroker = signalBrokers.find(b => signalEngine.byBroker[b]?.live) ?? signalBrokers[0];
  const signalsToday = signalBrokers.reduce((sum, b) => sum + (signalEngine.byBroker[b]?.signalsReceived ?? 0), 0);
  const lastSignalEntry = feed.find(e => e.domain === "signal");

  const execBrokers = executionEngine.brokers;
  const primaryExecBroker = execBrokers.find(b => executionEngine.byBroker[b]?.live) ?? execBrokers[0];
  const primaryExec = primaryExecBroker ? executionEngine.byBroker[primaryExecBroker] : undefined;
  const execMetrics = (primaryExec?.metrics ?? {}) as Record<string, unknown>;
  const ordersFilled = execMetrics.orders_filled;
  const ordersRejected = execMetrics.orders_rejected;
  const ordersTotal = isN(ordersFilled) ? ordersFilled + (isN(ordersRejected) ? ordersRejected : 0) : undefined;
  const successPct = isN(ordersFilled) && isN(ordersTotal) && ordersTotal > 0
    ? Math.round((ordersFilled / ordersTotal) * 100) : undefined;

  const totalBrokers = new Set([...signalBrokers, ...execBrokers]).size;

  return (
    <div className="page-wrap space-y-6">
      <PageHeader
        eyebrow="Apex Quantel"
        title="Overview"
        description="Your trading infrastructure, under control."
        right={<StatusBadge kind={healthToStatusKind(aggregate.state)} label={aggregate.headline} />}
      />

      <SystemHealthHero
        aggregate={aggregate}
        signal={signalHealth}
        execution={executionHealth}
        signalLastAt={signalEngine.lastMetricsAt}
        executionLastAt={primaryExec?.lastMetricsAt ?? null}
      />

      <section>
        <SectionHead label="How Your System Is Operating" />
        <OperationalFlow steps={flowSteps} />
      </section>

      <section>
        <SectionHead label="At A Glance" />
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
          <MetricCard
            label="Execution Engine"
            value={executionHealth.label}
            tone={executionHealth.state === "active" || executionHealth.state === "healthy" ? "success" : executionHealth.state === "offline" || executionHealth.state === "error" ? "danger" : "warning"}
            detail={primaryExec?.lastMetricsAt ? `Last heartbeat ${relativeAge(primaryExec.lastMetricsAt)}` : "No heartbeat yet"}
          />
          <MetricCard
            label="Signal Engine"
            value={primarySignalBroker ? `${signalsToday.toLocaleString()} signals today` : "No terminals connected"}
            tone={signalHealth.state === "active" || signalHealth.state === "healthy" ? "success" : signalHealth.state === "offline" || signalHealth.state === "error" ? "danger" : "warning"}
            detail={lastSignalEntry ? `Last signal ${relativeAge(lastSignalEntry.atMs)}` : "No signals received yet"}
          />
          <MetricCard
            label="Execution Activity"
            value={isN(ordersFilled) ? `${ordersFilled.toLocaleString()} orders processed` : "No orders yet"}
            tone={isN(successPct) ? (successPct >= 90 ? "success" : successPct >= 70 ? "warning" : "danger") : "neutral"}
            detail={isN(successPct) ? `${successPct}% successful · Today` : "Awaiting execution data"}
          />
        </div>
      </section>

      <SurfaceSection
        icon={ListTree}
        title="Recent Activity"
        subtitle="Latest events across signal and execution engines"
        actions={
          <Link href="/app/activity" className="btn btn-ghost btn-sm">
            View all <ArrowRight size={13} />
          </Link>
        }
        flush
      >
        <ActivityTimeline entries={feed} emptyMessage="No activity recorded yet." />
      </SurfaceSection>

      {totalBrokers > 1 && (
        <section>
          <SectionHead label="Connected Terminals" />
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
            {[...new Set([...signalBrokers, ...execBrokers])].sort().map(broker => {
              const sig = signalEngine.byBroker[broker];
              const exec = executionEngine.byBroker[broker];
              const live = (sig?.live ?? false) || (exec?.live ?? false);
              return (
                <div key={broker} className="kpi">
                  <div className="kpi-label">{broker}</div>
                  <div className="mt-2">
                    <StatusBadge kind={live ? "connected" : "disconnected"} label={live ? "Connected" : "Offline"} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
