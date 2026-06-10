import type { ReactNode } from "react";

export type MetricTone = "neutral" | "success" | "warning" | "danger" | "info";

const VALUE_COLOR: Record<Exclude<MetricTone, "neutral">, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
};

const ACCENT_CLASS: Record<Exclude<MetricTone, "neutral">, string> = {
  success: " kpi-good",
  warning: " kpi-warn",
  danger: " kpi-danger",
  info: " kpi-info",
};

export type MetricCardProps = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: MetricTone;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

/** The single KPI primitive. Replaces StatCard / Metric / page-local KPI grids. */
export function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
  size = "md",
  loading = false,
}: MetricCardProps) {
  const accent = tone !== "neutral" ? ACCENT_CLASS[tone] : "";
  const valueStyle =
    tone !== "neutral" ? { color: VALUE_COLOR[tone] } : undefined;
  const valueSize =
    size === "sm" ? "16px" : size === "lg" ? "26px" : "20px";
  return (
    <div className={`kpi${accent}`}>
      <div className="kpi-label">{label}</div>
      {loading ? (
        <div className="skeleton mt-2.5" style={{ height: valueSize, width: "60%" }} />
      ) : (
        <div className="kpi-value" style={{ ...valueStyle, fontSize: valueSize }}>
          {value ?? "--"}
        </div>
      )}
      {detail && !loading && <div className="kpi-detail">{detail}</div>}
    </div>
  );
}

/** Responsive grid wrapper for MetricCards. */
export function MetricGrid({
  cols = 4,
  children,
}: {
  cols?: 2 | 3 | 4 | 5;
  children: ReactNode;
}) {
  const cls =
    cols === 2 ? "grid grid-cols-1 sm:grid-cols-2 gap-2.5"
    : cols === 3 ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5"
    : cols === 5 ? "grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2.5"
    : "grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-2.5";
  return <div className={cls}>{children}</div>;
}
