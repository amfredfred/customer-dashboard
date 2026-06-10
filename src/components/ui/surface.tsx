import type { ReactNode } from "react";

export type SurfaceTone = "default" | "soft" | "active" | "danger" | "warning" | "success";

/**
 * Level-aware panel. Replaces raw `.panel`/`.card` usage.
 * level 1 = page panel, 2 = nested card, 3 = overlay-grade surface.
 */
export function Surface({
  tone = "default",
  level = 1,
  className = "",
  children,
}: {
  tone?: SurfaceTone;
  level?: 1 | 2 | 3;
  className?: string;
  children: ReactNode;
}) {
  const lv = level === 2 ? " lv2" : level === 3 ? " lv3" : "";
  const tn = tone !== "default" ? ` tone-${tone}` : "";
  return <div className={`surface${lv}${tn} ${className}`.trim()}>{children}</div>;
}

/** Panel with a titled header row - the standard sectioned surface. */
export function SurfaceSection({
  title,
  subtitle,
  badge,
  actions,
  flush = false,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  /** flush: content touches the panel edges (tables, feeds) */
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="surface overflow-hidden">
      <div className="panel-head">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--text-soft)] flex items-center gap-2">
            {title}
            {badge}
          </div>
          {subtitle && <p className="muted text-xs leading-5 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      <div className={flush ? "" : "panel-body"}>{children}</div>
    </section>
  );
}
