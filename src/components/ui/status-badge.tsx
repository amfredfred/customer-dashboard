export type StatusKind =
  | "online" | "live" | "active" | "connected" | "completed" | "running"
  | "healthy" | "market_open"
  | "degraded" | "waiting" | "connecting" | "pending" | "paused" | "warning" | "weekend" | "idle"
  | "offline" | "disconnected" | "expired" | "suspended" | "revoked" | "failed" | "rejected" | "forbidden" | "danger" | "error"
  | "info" | "none";

/**
 * `quiet: true` marks the "everything is fine" states. These render as a
 * small static dot + plain text instead of a bold pulsing pill - when every
 * indicator on a page is healthy, five loud green badges in a row is noise,
 * not signal. Only degraded/offline/danger states keep the bold treatment,
 * since those are exactly the things that should draw the eye.
 */
const KIND_STYLE: Record<StatusKind, { cls: string; dot: string | null; quiet?: boolean }> = {
  online:      { cls: "badge-green", dot: "dot-live", quiet: true },
  live:        { cls: "badge-green", dot: "dot-live", quiet: true },
  active:      { cls: "badge-green", dot: "dot-live", quiet: true },
  connected:   { cls: "badge-green", dot: "dot-live", quiet: true },
  completed:   { cls: "badge-green", dot: null,       quiet: true },
  running:     { cls: "badge-green", dot: "dot-live", quiet: true },
  healthy:     { cls: "badge-green", dot: "dot-live", quiet: true },
  market_open: { cls: "badge-green", dot: "dot-live", quiet: true },
  degraded:    { cls: "badge-warn",  dot: "dot-warn" },
  waiting:     { cls: "badge-warn",  dot: "dot-warn pulse" },
  connecting:  { cls: "badge-warn",  dot: "dot-warn pulse" },
  pending:     { cls: "badge-warn",  dot: null },
  paused:      { cls: "badge-warn",  dot: "dot-warn" },
  warning:     { cls: "badge-warn",  dot: "dot-warn" },
  weekend:     { cls: "badge-warn",  dot: "dot-warn" },
  idle:        { cls: "badge-muted", dot: "dot-muted" },
  offline:     { cls: "badge-muted", dot: "dot-muted" },
  disconnected:{ cls: "badge-muted", dot: "dot-muted" },
  expired:     { cls: "badge-red",   dot: null },
  suspended:   { cls: "badge-red",   dot: null },
  revoked:     { cls: "badge-red",   dot: null },
  failed:      { cls: "badge-red",   dot: null },
  rejected:    { cls: "badge-red",   dot: null },
  forbidden:   { cls: "badge-red",   dot: null },
  danger:      { cls: "badge-red",   dot: "dot-dead" },
  error:       { cls: "badge-red",   dot: "dot-dead" },
  info:        { cls: "badge-blue",  dot: null },
  none:        { cls: "badge-muted", dot: null },
};

/** Standardised state badge for online/offline/degraded/license/command states. */
export function StatusBadge({
  kind,
  label,
}: {
  kind: StatusKind;
  /** Defaults to the kind name. */
  label?: string;
}) {
  const s = KIND_STYLE[kind] ?? KIND_STYLE.none;
  const text = label ?? kind.replace(/_/g, " ");

  if (s.quiet) {
    return (
      <span className="badge-quiet">
        {s.dot && <span className="dot-sm" />}
        {text}
      </span>
    );
  }
  return (
    <span className={`badge ${s.cls}`}>
      {s.dot && <span className={`dot ${s.dot}`} />}
      {text}
    </span>
  );
}

/** Maps an arbitrary backend status string onto a StatusKind. */
export function statusKindOf(status: string | null | undefined): StatusKind {
  const s = (status ?? "").toLowerCase();
  if (s in KIND_STYLE) return s as StatusKind;
  if (s === "ok" || s === "success") return "healthy";
  if (s === "down") return "danger";
  return "none";
}
