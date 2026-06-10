import type { ReactNode } from "react";

export type SetupStep = {
  label: string;
  /** done → checked; current → highlighted; upcoming → muted */
  state: "done" | "current" | "upcoming";
  action?: ReactNode;
};

/**
 * Dominant guided next-action card for incomplete setup.
 * Renders the full step list with the current step emphasised.
 */
export function ActionCard({
  title,
  description,
  steps,
}: {
  title: string;
  description?: string;
  steps: SetupStep[];
}) {
  return (
    <section className="surface tone-active overflow-hidden">
      <div className="panel-body !py-5">
        <div className="text-sm font-bold">{title}</div>
        {description && <p className="muted text-xs leading-5 mt-1 max-w-xl">{description}</p>}
        <ol className="m-0 mt-4 pl-0 list-none space-y-2.5">
          {steps.map((s, i) => {
            const done = s.state === "done";
            const current = s.state === "current";
            return (
              <li key={i} className="flex items-center gap-3">
                <span
                  className="shrink-0 w-[22px] h-[22px] rounded-md flex items-center justify-center text-[11px] font-bold"
                  style={
                    done
                      ? { background: "var(--success-bg)", border: "1px solid var(--success-border)", color: "var(--success)" }
                      : current
                      ? { background: "var(--surface-3)", border: "1px solid var(--line-strong)", color: "var(--text)" }
                      : { background: "transparent", border: "1px solid var(--line)", color: "var(--muted)" }
                  }
                >
                  {done ? "✓" : i + 1}
                </span>
                <span
                  className="text-[12.5px] flex-1"
                  style={{
                    color: current ? "var(--text)" : done ? "var(--text-soft)" : "var(--muted)",
                    fontWeight: current ? 600 : 400,
                    textDecoration: done ? "line-through" : undefined,
                    textDecorationColor: done ? "var(--line-strong)" : undefined,
                  }}
                >
                  {s.label}
                </span>
                {current && s.action && <span className="shrink-0">{s.action}</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
