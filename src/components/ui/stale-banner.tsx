"use client";

import { useEffect, useState } from "react";

/** Warning banner shown when a live stream has stopped reporting recently. */
export function StaleBanner({
  label,
  lastUpdatedAt,
}: {
  label: string;
  lastUpdatedAt: number | null;
}) {
  const seconds = useAgeSeconds(lastUpdatedAt);
  return (
    <div className="alert tone-warning">
      <span className="dot dot-warn pulse" style={{ marginTop: 4 }} />
      <span>
        <strong>{label}</strong> hasn&apos;t reported in {seconds !== null ? `${seconds}s` : "a while"} -
        the connection is still open, but data may be out of date.
      </span>
    </div>
  );
}

/** Small "updated Ns ago" text, ticking every second. */
export function LastUpdated({ at }: { at: number | null }) {
  const seconds = useAgeSeconds(at);
  if (at === null) return <span className="muted text-[11px]">never updated</span>;
  return (
    <span className="muted text-[11px] mono">
      updated {seconds === 0 ? "just now" : `${seconds}s ago`}
    </span>
  );
}

function useAgeSeconds(at: number | null): number | null {
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (at === null) return;
    const timer = setInterval(() => forceTick(n => n + 1), 1000);
    return () => clearInterval(timer);
  }, [at]);
  if (at === null) return null;
  return Math.max(0, Math.round((Date.now() - at) / 1000));
}
