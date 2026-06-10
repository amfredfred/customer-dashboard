export type MeterTone = "success" | "warning" | "danger" | "info" | "auto";

/**
 * Horizontal usage meter. `value` is 0..1.
 * tone "auto": green < warnAt, amber < dangerAt, red above.
 */
export function Meter({
  value,
  tone = "auto",
  warnAt = 0.7,
  dangerAt = 0.9,
  label,
  detail,
}: {
  value: number;
  tone?: MeterTone;
  warnAt?: number;
  dangerAt?: number;
  label?: string;
  detail?: string;
}) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const resolved =
    tone !== "auto" ? tone
    : clamped >= dangerAt ? "danger"
    : clamped >= warnAt ? "warning"
    : "success";
  const fillCls =
    resolved === "danger" ? "meter-fill danger"
    : resolved === "warning" ? "meter-fill warn"
    : resolved === "info" ? "meter-fill info"
    : "meter-fill";
  return (
    <div>
      {(label || detail) && (
        <div className="flex items-baseline justify-between mb-1.5 gap-3">
          {label && <span className="kpi-label">{label}</span>}
          {detail && <span className="text-[11px] muted mono">{detail}</span>}
        </div>
      )}
      <div className="meter-track">
        <div className={fillCls} style={{ width: `${clamped * 100}%` }} />
      </div>
    </div>
  );
}
