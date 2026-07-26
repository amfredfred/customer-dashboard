import { EventFeed, type FeedEvent } from "./event-feed";
import type { UnifiedActivityEntry } from "@/lib/system-health";

/** Known event types get a plain-English label; anything else falls back to
 *  a humanized version of the raw type - never a fabricated description. */
const FRIENDLY_LABELS: Record<string, string> = {
  "signal.triggered": "Signal Triggered",
  "signal.received": "Signal Received",
  "signal.opened": "Signal Opened",
  "signal.rejected": "Signal Rejected",
  "signal.filtered": "Signal Filtered",
  "strategy.rejected": "Strategy Rejected",
  "risk.approved": "Risk Approved",
  "risk.rejected": "Risk Rejected",
  "trade.opened": "Trade Opened",
  "trade.closed": "Trade Closed",
  "trade.tp1_hit": "TP1 Hit",
  "trade.tp2_hit": "TP2 Hit",
  "trade.sl_hit": "Stop Loss Hit",
  "trade.error": "Trade Error",
  "order.filled": "Order Filled",
  "position.partial_tp": "Partial Take Profit",
  "position.updated": "Position Updated",
  "position.sync": "Position Synced",
  "engine.paused": "Engine Paused",
  "engine.resumed": "Engine Resumed",
  "parity.warning": "Parity Warning",
};

function humanize(eventType: string): string {
  return FRIENDLY_LABELS[eventType] ?? eventType.replace(/[._]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/** Customer-facing wrapper over EventFeed: translates raw event_type strings
 *  into plain-English labels and tags rows by domain/broker. */
export function ActivityTimeline({
  entries, emptyMessage = "No activity yet.", maxHeight, showDomainTag = true,
}: {
  entries: UnifiedActivityEntry[];
  emptyMessage?: string;
  maxHeight?: number;
  /** Show the "signal"/"execution" domain chip - turn off on single-domain pages. */
  showDomainTag?: boolean;
}) {
  const events: FeedEvent[] = entries.map(e => ({
    id: e.id,
    type: humanize(e.eventType),
    time: e.ts,
    summary: e.summary,
    tone: e.severity,
    tag: showDomainTag
      ? (e.broker ? `${e.domain} · ${e.broker}` : e.domain)
      : e.broker,
    details: e.raw,
  }));

  return <EventFeed events={events} emptyMessage={emptyMessage} maxHeight={maxHeight} />;
}
