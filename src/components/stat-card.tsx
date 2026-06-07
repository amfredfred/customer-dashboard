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
  const color =
    tone === "good"   ? "text-[#3ddc97]"
    : tone === "warn"   ? "text-[#f5b942]"
    : tone === "danger" ? "text-[#f43f5e]"
    : "";
  return (
    <div className="panel p-4 min-h-28">
      <div className="text-[10px] uppercase tracking-[.13em] muted">{label}</div>
      <div className={`mt-4 text-2xl font-semibold tracking-tight ${color}`}>{value}</div>
      {detail && <div className="mt-2 text-xs muted">{detail}</div>}
    </div>
  );
}
