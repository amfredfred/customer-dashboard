export type StatusKind =
  | "online" | "live" | "active" | "connected" | "completed" | "running"
  | "degraded" | "waiting" | "connecting" | "pending" | "paused"
  | "offline" | "expired" | "suspended" | "revoked" | "failed" | "rejected" | "forbidden" | "danger"
  | "info" | "none";

const KIND_STYLE: Record<StatusKind, { cls: string; dot: string | null }> = {
  online:     { cls: "badge-green", dot: "dot-live pulse" },
  live:       { cls: "badge-green", dot: "dot-live pulse" },
  active:     { cls: "badge-green", dot: "dot-live" },
  connected:  { cls: "badge-green", dot: "dot-live" },
  completed:  { cls: "badge-green", dot: null },
  running:    { cls: "badge-green", dot: "dot-live" },
  degraded:   { cls: "badge-warn",  dot: "dot-warn" },
  waiting:    { cls: "badge-warn",  dot: "dot-warn pulse" },
  connecting: { cls: "badge-warn",  dot: "dot-warn pulse" },
  pending:    { cls: "badge-warn",  dot: null },
  paused:     { cls: "badge-warn",  dot: "dot-warn" },
  offline:    { cls: "badge-muted", dot: "dot-muted" },
  expired:    { cls: "badge-red",   dot: null },
  suspended:  { cls: "badge-red",   dot: null },
  revoked:    { cls: "badge-red",   dot: null },
  failed:     { cls: "badge-red",   dot: null },
  rejected:   { cls: "badge-red",   dot: null },
  forbidden:  { cls: "badge-red",   dot: null },
  danger:     { cls: "badge-red",   dot: "dot-dead" },
  info:       { cls: "badge-blue",  dot: null },
  none:       { cls: "badge-muted", dot: null },
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
  return (
    <span className={`badge ${s.cls}`}>
      {s.dot && <span className={`dot ${s.dot}`} />}
      {label ?? kind}
    </span>
  );
}

/** Maps an arbitrary backend status string onto a StatusKind. */
export function statusKindOf(status: string | null | undefined): StatusKind {
  const s = (status ?? "").toLowerCase();
  if (s in KIND_STYLE) return s as StatusKind;
  if (s === "ok" || s === "success" || s === "healthy") return "active";
  if (s === "error" || s === "down") return "danger";
  return "none";
}
