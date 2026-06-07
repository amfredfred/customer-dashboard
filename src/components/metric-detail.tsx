import type { ReactNode } from "react";

export type MetricTone = "normal" | "good" | "warn" | "danger";

export function DetailSection({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <section className="panel p-4 md:p-5 min-w-0">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <p className="muted text-xs leading-5 mt-1">{subtitle}</p>}
        </div>
        {badge && (
          <span className="badge badge-muted shrink-0">{badge}</span>
        )}
      </div>
      {children}
    </section>
  );
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {children}
    </div>
  );
}

export function Metric({
  label,
  value = "--",
  detail,
  tone = "normal",
}: {
  label: string;
  value?: string;
  detail?: string;
  tone?: MetricTone;
}) {
  const color =
    tone === "good"   ? "text-[#3ddc97]"
    : tone === "warn"   ? "text-[#f5b942]"
    : tone === "danger" ? "text-[#f43f5e]"
    : "";
  return (
    <div className="metric-tile">
      <div className="text-[10px] uppercase tracking-[.12em] muted">{label}</div>
      <div className={`mt-2 text-lg font-semibold mono break-words ${color}`}>{value}</div>
      {detail && <div className="muted mt-1 text-[11px] leading-4">{detail}</div>}
    </div>
  );
}

export function EmptyTable({
  columns,
  message,
}: {
  columns: string[];
  message: string;
}) {
  return (
    <div className="detail-table-wrap">
      <table className="detail-table">
        <thead>
          <tr>{columns.map(c => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          <tr><td colSpan={columns.length} className="empty-cell">{message}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

export function DataTable({
  columns,
  rows,
  emptyMessage,
}: {
  columns: string[];
  rows: ReactNode[][];
  emptyMessage: string;
}) {
  if (rows.length === 0) return <EmptyTable columns={columns} message={emptyMessage} />;
  return (
    <div className="detail-table-wrap">
      <table className="detail-table">
        <thead>
          <tr>{columns.map(c => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => <td key={ci}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StreamBanner({
  domain,
  ready = false,
  status,
  children,
}: {
  domain: string;
  ready?: boolean;
  status?: string;
  children: ReactNode;
}) {
  const isError = Boolean(status && status !== "Live metric stream active");
  return (
    <div className={`stream-banner${ready ? " live" : isError ? " error" : ""}`}>
      <div>
        <div
          className={`text-xs font-semibold flex items-center gap-2 ${
            ready ? "text-[#3ddc97]" : isError ? "text-[#f43f5e]" : "text-[#f5b942]"
          }`}
        >
          <span className={`dot ${ready ? "dot-live pulse" : isError ? "dot-dead" : "dot-warn"}`} />
          {status ?? (ready ? "Live metric stream active" : "Awaiting live metric stream")}
        </div>
        <p className="muted text-xs leading-5 mt-1">{children}</p>
      </div>
      <span className="pill mono shrink-0">{domain}</span>
    </div>
  );
}
