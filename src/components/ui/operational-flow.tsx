import { Radio, Cpu, Building2, ListTree } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { HealthState } from "@/lib/system-health";

export interface FlowStepDef {
  icon: LucideIcon;
  label: string;
  state: HealthState;
  detail: string;
}

const STATE_DOT: Record<HealthState, string> = {
  healthy: "dot-live", active: "dot-live", waiting: "dot-warn pulse",
  degraded: "dot-warn pulse", stale: "dot-warn pulse", offline: "dot-dead", error: "dot-dead",
};

/**
 * Signal -> Execution -> Broker -> Activity, rendered as a simple step
 * indicator (not a literal diagram) - conveys how the system operates as a
 * whole without implying data the backend doesn't report (brief §7).
 */
export function OperationalFlow({ steps }: { steps: FlowStepDef[] }) {
  return (
    <div className="flow-row">
      {steps.map((s, i) => (
        <div className="flow-step-wrap" key={s.label}>
          <div className="flow-step">
            <div className="flow-step-icon">
              <s.icon size={15} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <div className="flow-step-label">
                <span className={`dot ${STATE_DOT[s.state]}`} />
                {s.label}
              </div>
              <div className="flow-step-detail">{s.detail}</div>
            </div>
          </div>
          {i < steps.length - 1 && <div className="flow-connector" aria-hidden />}
        </div>
      ))}
    </div>
  );
}

export { Radio, Cpu, Building2, ListTree };
