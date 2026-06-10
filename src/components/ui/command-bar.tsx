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

  return (
    <div className="cmd-bar">
      <div className="flex items-center gap-2.5 min-w-0">{context}</div>
      <div className="cmd-divider" />
      <div className="flex items-center gap-2 flex-wrap">{normal.map(renderBtn)}</div>
      {dangerous.length > 0 && (
        <div className="cmd-danger-zone">
          <span className="cmd-danger-label">Danger zone</span>
          {dangerous.map(renderBtn)}
        </div>
      )}
      <div className="flex-1" />
      {right ? (
        <div className="shrink-0">{right}</div>
      ) : (stateLine || commandLine) ? (
        <div className="flex flex-col items-end gap-0.5 min-w-0">
          {stateLine && <div className="cmd-state">{stateLine}</div>}
          {commandLine && <div className="cmd-state">{commandLine}</div>}
        </div>
      ) : null}
    </div>
  );
}
