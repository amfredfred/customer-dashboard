import type { ReactNode } from "react";

export type CommandDef = {
  id: string;
  label: string;
  /** Dangerous commands render in the separated danger zone. */
  dangerous?: boolean;
  /** Visual tone for the button: warn = amber, success = green, default = neutral */
  variant?: "warn" | "success";
  disabled?: boolean;
  /** Shown as tooltip + aria when disabled, e.g. "Engine is not paused". */
  disabledReason?: string;
  onClick: () => void;
};

/**
 * Serious command strip for engine remote control.
 * Presentational only - confirmation flow and /commands/:id polling stay
 * with the caller so existing state-gating logic is untouched.
 */
export function CommandBar({
  context,
  commands,
  stateLine,
  commandLine,
  right,
  busy = false,
}: {
  /** What is being commanded, e.g. engine selector or engine name + status pill. */
  context: ReactNode;
  commands: CommandDef[];
  /** e.g. "State: Running" */
  stateLine?: ReactNode;
  /** e.g. "Command: Sending…" */
  commandLine?: ReactNode;
  /** Arbitrary right-side content (replaces stateLine/commandLine column when set). */
  right?: ReactNode;
  /** Disables every button (a command is in flight). */
  busy?: boolean;
}) {
  const normal = commands.filter((c) => !c.dangerous);
  const dangerous = commands.filter((c) => c.dangerous);

  const renderBtn = (c: CommandDef) => {
    const variantClass = c.dangerous ? " btn-danger"
      : c.variant === "warn"    ? " btn-warn"
      : c.variant === "success" ? " btn-success-soft"
      : "";
    return (
      <button
        key={c.id}
        className={`btn btn-sm${variantClass}`}
        disabled={busy || c.disabled}
        onClick={c.onClick}
        title={c.disabled && c.disabledReason ? c.disabledReason : undefined}
        aria-label={
          c.disabled && c.disabledReason ? `${c.label} - ${c.disabledReason}` : c.label
        }
      >
        {c.label}
      </button>
    );
  };

  const hasRight = dangerous.length > 0 || right || stateLine || commandLine;

  return (
    <div className="cmd-bar">
      {/* Left: context + divider + normal buttons - always inline */}
      <div className="flex items-center gap-3 flex-wrap min-w-0">
        <div className="flex items-center gap-2.5 shrink-0 min-w-0">{context}</div>
        <div className="cmd-divider self-stretch" />
        <div className="flex items-center gap-2">{normal.map(renderBtn)}</div>
      </div>

      {/* Right group: danger zone + right/state - ml-auto on desktop, full-width on mobile */}
      {hasRight && (
        <div className="cmd-bar-right">
          {dangerous.length > 0 && (
            <div className="cmd-danger-zone cmd-danger-zone-responsive">
              <span className="cmd-danger-label">Danger zone</span>
              {dangerous.map(renderBtn)}
            </div>
          )}
          {right && <div className="cmd-bar-right-slot">{right}</div>}
          {!right && (stateLine || commandLine) && (
            <div className="flex flex-col items-end gap-0.5 min-w-0">
              {stateLine  && <div className="cmd-state">{stateLine}</div>}
              {commandLine && <div className="cmd-state">{commandLine}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
