import type { ReactNode } from "react";

export type MetricTone = "normal" | "good" | "warn" | "danger";

/* ── Section head ────────────────────────────────────────────────────── */
export function SectionHead({
  label,
  action,
}: {
  label: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-rule">
      <span className="section-rule-bar" />
      <span className="section-rule-label">{label}</span>
      <span className="section-rule-line" />
      {action && <span className="shrink-0 ml-2">{action}</span>}
    </div>
  );
}

/* ── Page header ─────────────────────────────────────────────────────── */
export function PageHeader({
  eyebrow,
  title,
  description,
  right,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  right?: ReactNode;
}) {
  return (
    <div className={`flex flex-wrap items-start gap-4 mb-6${right ? " justify-between" : ""}`}>
      <div>
        {eyebrow && (
          <div className="text-[10px] uppercase tracking-[.17em] muted mb-1">{eyebrow}</div>
        )}
        <h1 className="text-2xl font-bold tracking-tight leading-tight">{title}</h1>
        {description && (
          <p className="muted mt-1.5 text-sm leading-5 max-w-2xl">{description}</p>
        )}
      </div>
      {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
    </div>
  );
}

/* ── Detail section (panel + header + content) ───────────────────────── */
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
    <section className="panel overflow-hidden">
      <div className="panel-head">
        <div>
          <div className="text-sm font-semibold text-[var(--text-soft)]">{title}</div>
          {subtitle && (
            <p className="muted text-xs leading-5 mt-0.5">{subtitle}</p>
          )}
        </div>
        {badge && <span className="badge badge-muted shrink-0">{badge}</span>}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

/* ── Metric grid ─────────────────────────────────────────────────────── */
export function MetricGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
      {children}
    </div>
  );
}

/* ── KPI metric card ─────────────────────────────────────────────────── */
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

/* ── Empty table ─────────────────────────────────────────────────────── */
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
          <tr>
            <td colSpan={columns.length} className="empty-cell">{message}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ── Data table ──────────────────────────────────────────────────────── */
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

/* ── Stream banner ───────────────────────────────────────────────────── */
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
      <span className="pill mono shrink-0 text-xs">{domain}</span>
    </div>
  );
}
