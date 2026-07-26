"use client";

import { useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import { useSignalEngine } from "@/components/signal-engine-provider";
import { useExecutionEngine } from "@/components/execution-engine-provider";
import { PageHeader } from "@/components/metric-detail";
import { SurfaceSection } from "@/components/ui/surface";
import { ActivityTimeline } from "@/components/ui/activity-timeline";
import { EmptyState } from "@/components/ui/empty-state";
import { unifiedActivityFeed, type ActivityDomain } from "@/lib/system-health";
import type { FeedTone } from "@/components/ui/event-feed";

type DomainFilter = "all" | ActivityDomain;
type SeverityFilter = "all" | FeedTone;

const DOMAIN_FILTERS: Array<{ id: DomainFilter; label: string }> = [
  { id: "all",       label: "All Domains" },
  { id: "signal",    label: "Signal Engine" },
  { id: "execution", label: "Execution Engine" },
];

const SEVERITY_FILTERS: Array<{ id: SeverityFilter; label: string }> = [
  { id: "all",     label: "All" },
  { id: "success", label: "Success" },
  { id: "warning", label: "Warning" },
  { id: "danger",  label: "Danger" },
  { id: "info",    label: "Info" },
];

export default function Activity() {
  const signalEngine = useSignalEngine();
  const executionEngine = useExecutionEngine();
  const [domain, setDomain] = useState<DomainFilter>("all");
  const [severity, setSeverity] = useState<SeverityFilter>("all");

  const feed = useMemo(
    () => unifiedActivityFeed(signalEngine.recentEvents, executionEngine.byBroker, 500),
    [signalEngine.recentEvents, executionEngine.byBroker],
  );

  const filtered = feed.filter(e =>
    (domain === "all" || e.domain === domain) &&
    (severity === "all" || e.severity === severity),
  );

  const noEnginesConnected =
    signalEngine.status !== "connected" && executionEngine.status !== "connected";

  return (
    <div className="page-wrap space-y-5">
      <PageHeader
        eyebrow="Unified timeline"
        title="Activity"
        description="Every meaningful event across your signal and execution engines, in one place."
      />

      {noEnginesConnected ? (
        <EmptyState
          icon={Inbox}
          title="Not connected"
          description="Connect to the signal and execution engines to start streaming activity here."
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {DOMAIN_FILTERS.map(f => (
                <button
                  key={f.id}
                  type="button"
                  className={`btn btn-sm ${domain === f.id ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setDomain(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              {SEVERITY_FILTERS.map(f => (
                <button
                  key={f.id}
                  type="button"
                  className={`btn btn-sm ${severity === f.id ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setSeverity(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <SurfaceSection
            icon={Inbox}
            title="Activity"
            subtitle={`${filtered.length} event${filtered.length !== 1 ? "s" : ""}${feed.length > filtered.length ? ` (of ${feed.length} total)` : ""}`}
            badge={<span className="badge badge-muted">{filtered.length}</span>}
            flush
          >
            <ActivityTimeline
              entries={filtered}
              emptyMessage="No activity matches these filters yet."
              maxHeight={720}
            />
          </SurfaceSection>
        </>
      )}
    </div>
  );
}
