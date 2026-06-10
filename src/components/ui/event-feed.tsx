"use client";

import { useState } from "react";

export type FeedTone = "neutral" | "success" | "warning" | "danger" | "info";

export type FeedEvent = {
  id: string;
  /** Short event type chip, e.g. "order.filled" */
  type: string;
  /** Epoch ms or preformatted string */
  time: number | string;
  summary: string;
  tone?: FeedTone;
  /** Raw payload shown in an expandable JSON drawer */
  details?: unknown;
};

function formatTime(t: number | string): string {
  if (typeof t === "string") return t;
  try {
    return new Date(t).toLocaleTimeString([], {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return String(t);
  }
}

/**
 * Unified feed for recent_events / rejections / activity / logs.
 * Rows with `details` expand into a JSON drawer on click.
 */
export function EventFeed({
  events,
  emptyMessage = "No events yet.",
  maxHeight,
}: {
  events: FeedEvent[];
  emptyMessage?: string;
  maxHeight?: number;
}) {
  const [open, setOpen] = useState<string | null>(null);

  if (events.length === 0) {
    return <div className="state-block">{emptyMessage}</div>;
  }

  return (
    <div
      className="feed"
      style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}
    >
      {events.map((e) => {
        const expandable = e.details !== undefined && e.details !== null;
        const expanded = open === e.id;
        const toneCls = e.tone && e.tone !== "neutral" ? ` tone-${e.tone}` : "";
        return (
          <div key={e.id}>
            <div
              className={`feed-row${expandable ? " clickable" : ""}`}
              onClick={expandable ? () => setOpen(expanded ? null : e.id) : undefined}
            >
              <span className="feed-time mono">{formatTime(e.time)}</span>
              <span className={`feed-type${toneCls}`}>{e.type}</span>
              <span className="feed-summary">{e.summary}</span>
              {expandable && (
                <span className="muted text-[10px] shrink-0 pt-0.5">{expanded ? "▾" : "▸"}</span>
              )}
            </div>
            {expanded && (
              <pre className="feed-json">{JSON.stringify(e.details, null, 2)}</pre>
            )}
          </div>
        );
      })}
    </div>
  );
}
