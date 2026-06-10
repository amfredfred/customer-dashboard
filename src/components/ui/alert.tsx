import type { ReactNode } from "react";

export type AlertTone = "neutral" | "success" | "warning" | "danger" | "info";

export function Alert({
  tone = "neutral",
  title,
  children,
  actions,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const toneCls = tone !== "neutral" ? ` tone-${tone}` : "";
  const titleColor =
    tone === "success" ? "var(--success)"
    : tone === "warning" ? "var(--warning)"
    : tone === "danger" ? "var(--danger)"
    : tone === "info" ? "var(--info)"
    : "var(--text-soft)";
  return (
    <div className={`alert${toneCls}`}>
      <div className="flex-1 min-w-0">
        {title && (
          <div className="text-xs font-semibold mb-0.5" style={{ color: titleColor }}>
            {title}
          </div>
        )}
        {children}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}
