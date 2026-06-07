export function StatCard({
  label,
  value,
  detail,
  tone = "normal",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "normal" | "good" | "warn" | "danger";
}) {
  const kpiClass =
    tone === "good"   ? " kpi-good"
    : tone === "warn"   ? " kpi-warn"
    : tone === "danger" ? " kpi-danger"
    : "";
  const valClass =
    tone === "good"   ? " good"
    : tone === "warn"   ? " warn"
    : tone === "danger" ? " danger"
    : "";
  return (
    <div className={`kpi${kpiClass}`}>
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value${valClass}`}>{value}</div>
      {detail && <div className="kpi-detail">{detail}</div>}
    </div>
  );
}
