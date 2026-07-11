import type { ComponentType, ReactNode } from "react";

/**
 * Operational empty state: states exactly what is missing and what to do next.
 * Prefer numbered `steps` over decoration; `icon` is a single lucide-react
 * component reinforcing the content, not decoration for its own sake.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  steps,
  action,
}: {
  icon?: ComponentType<{ size?: number; strokeWidth?: number }>;
  title: string;
  description?: string;
  steps?: string[];
  action?: ReactNode;
}) {
  return (
    <div className="state-block !items-start text-left">
      {Icon && (
        <div className="empty-state-icon">
          <Icon size={20} strokeWidth={1.75} />
        </div>
      )}
      <div className="text-[13px] font-semibold text-[var(--text-soft)]">{title}</div>
      {description && <p className="text-xs leading-5 max-w-md m-0">{description}</p>}
      {steps && steps.length > 0 && (
        <ol className="m-0 mt-1 pl-0 list-none space-y-1.5">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2.5 text-xs leading-5">
              <span
                className="shrink-0 w-[18px] h-[18px] rounded flex items-center justify-center text-[10px] font-bold mt-0.5"
                style={{
                  background: "var(--surface-3)",
                  border: "1px solid var(--line)",
                  color: "var(--text-soft)",
                }}
              >
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
