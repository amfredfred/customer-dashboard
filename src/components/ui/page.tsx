import type { ReactNode } from "react";

/** Consistent page width, spacing, header and right-side actions. */
export function Page({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="page-wrap">
      <div className={`flex flex-wrap items-start gap-4 mb-6${actions ? " justify-between" : ""}`}>
        <div className="min-w-0">
          {eyebrow && (
            <div className="text-[10px] uppercase tracking-[.17em] muted mb-1">{eyebrow}</div>
          )}
          <h1 className="text-2xl font-bold tracking-tight leading-tight">{title}</h1>
          {description && (
            <p className="muted mt-1.5 text-sm leading-5 max-w-2xl">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

/** Labeled horizontal rule between page sections. */
export function SectionRule({ label, action }: { label: string; action?: ReactNode }) {
  return (
    <div className="section-rule">
      <span className="section-rule-bar" />
      <span className="section-rule-label">{label}</span>
      <span className="section-rule-line" />
      {action && <span className="shrink-0 ml-2">{action}</span>}
    </div>
  );
}
