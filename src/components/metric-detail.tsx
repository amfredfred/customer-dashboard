import type { ReactNode } from "react";

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
