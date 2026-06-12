import type { ReactNode } from "react";

function Frame({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: ReactNode;
}) {
  return (
    <figure className="public-diagram">
      <div className="public-diagram-head">
        <span>{title}</span>
        <span className="public-diagram-caption">{caption}</span>
      </div>
      <div className="public-diagram-canvas">{children}</div>
    </figure>
  );
}

function Arrow({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return (
    <g aria-hidden="true">
      <line x1={x1} y1={y1} x2={x2} y2={y2} className="diagram-line" />
      <path d={`M ${x2 - 6} ${y2 - 4} L ${x2} ${y2} L ${x2 - 6} ${y2 + 4}`} className="diagram-line" />
    </g>
  );
}

function Node({
  x,
  y,
  w,
  label,
  sub,
  tone = "violet",
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  sub?: string;
  tone?: "violet" | "red" | "green" | "neutral";
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={sub ? 54 : 42} rx="7" className={`diagram-node ${tone}`} />
      <text x={x + 12} y={y + 18} className="diagram-label">{label}</text>
      {sub && <text x={x + 12} y={y + 36} className="diagram-sub">{sub}</text>}
    </g>
  );
}

export function ExecutionFlowDiagram() {
  return (
    <Frame title="Execution flow" caption="Signal route and local authority">
      <svg viewBox="0 0 820 266" role="img" aria-labelledby="execution-flow-title">
        <title id="execution-flow-title">Private signal routed through the gateway and local risk engine to MT5 execution and dashboard logs</title>
        <g className="diagram-grid" aria-hidden="true">
          <path d="M0 64H820M0 132H820M0 200H820M130 0V266M410 0V266M690 0V266" />
        </g>
        <Node x={24} y={28} w={142} label="Private signal" sub="Released setup" />
        <Node x={226} y={28} w={164} label="Apex Gateway" sub="Licensed routing" />
        <Node x={450} y={28} w={146} label="Licence check" sub="Room authority" tone="red" />
        <Node x={656} y={28} w={140} label="Local AQ Agent" sub="Final authority" />
        <Arrow x1={166} y1={55} x2={226} y2={55} />
        <Arrow x1={390} y1={55} x2={450} y2={55} />
        <Arrow x1={596} y1={55} x2={656} y2={55} />

        <Node x={656} y={132} w={140} label="MT5 terminal" sub="Local broker link" tone="neutral" />
        <Node x={450} y={132} w={146} label="Risk engine" sub="Approve / reject" tone="red" />
        <Node x={226} y={132} w={164} label="Order execution" sub="Sized market order" tone="green" />
        <Node x={24} y={132} w={142} label="Dashboard logs" sub="Events + telemetry" tone="neutral" />
        <path d="M726 82V105H523V132" className="diagram-line" aria-hidden="true" />
        <Arrow x1={656} y1={159} x2={596} y2={159} />
        <Arrow x1={450} y1={159} x2={390} y2={159} />
        <Arrow x1={226} y1={159} x2={166} y2={159} />

        <rect x="24" y="218" width="772" height="24" rx="5" className="diagram-note red" />
        <text x="36" y="234" className="diagram-note-text">Cloud routes and records. The installed agent decides whether an order is safe to place.</text>
      </svg>
    </Frame>
  );
}

export function LocalAgentArchitectureDiagram() {
  return (
    <Frame title="Local agent architecture" caption="Cloud control, local execution">
      <svg viewBox="0 0 720 320" role="img" aria-labelledby="agent-architecture-title">
        <title id="agent-architecture-title">Dashboard and gateway connected to a local Windows AQ Agent and MetaTrader 5 terminal</title>
        <rect x="22" y="24" width="676" height="112" rx="10" className="diagram-zone cloud" />
        <text x="38" y="48" className="diagram-kicker">CLOUD CONTROL PLANE</text>
        <Node x={54} y={66} w={186} label="Customer dashboard" sub="Monitor + command" tone="neutral" />
        <Node x={474} y={66} w={186} label="Execution gateway" sub="Authenticate + route" />
        <Arrow x1={240} y1={93} x2={474} y2={93} />

        <rect x="22" y="164" width="676" height="132" rx="10" className="diagram-zone local" />
        <text x="38" y="188" className="diagram-kicker">CUSTOMER WINDOWS MACHINE</text>
        <Node x={54} y={208} w={186} label="Local AQ Agent" sub="Risk + sizing + control" tone="red" />
        <Node x={474} y={208} w={186} label="MT5 terminal" sub="Broker connection" tone="green" />
        <Arrow x1={240} y1={235} x2={474} y2={235} />
        <path d="M567 120V150H147V208" className="diagram-line dashed" aria-hidden="true" />
        <text x="284" y="148" className="diagram-sub">secure outbound connection</text>
      </svg>
    </Frame>
  );
}

export function RiskEngineDiagram() {
  const checks = [
    ["Account state", "neutral"],
    ["Symbol state", "neutral"],
    ["Spread / SL ratio", "red"],
    ["Lot limits", "neutral"],
    ["Exposure", "red"],
    ["Drawdown", "red"],
    ["No-hedging rule", "neutral"],
  ] as const;
  return (
    <Frame title="Risk engine" caption="Every gate must approve">
      <svg viewBox="0 0 720 390" role="img" aria-labelledby="risk-engine-title">
        <title id="risk-engine-title">Stack of local risk checks leading to order approval or rejection</title>
        <text x="32" y="30" className="diagram-kicker">LOCAL PRE-TRADE GATES</text>
        {checks.map(([label, tone], i) => {
          const y = 48 + i * 39;
          return (
            <g key={label}>
              <rect x="32" y={y} width="438" height="30" rx="5" className={`diagram-node ${tone}`} />
              <text x="46" y={y + 19} className="diagram-label">{label}</text>
              <circle cx="447" cy={y + 15} r="4" className="diagram-check" />
            </g>
          );
        })}
        <path d="M470 63H520V297H470" className="diagram-line" aria-hidden="true" />
        <Node x={548} y={120} w={140} label="Approved" sub="Order may proceed" tone="green" />
        <Node x={548} y={208} w={140} label="Rejected" sub="Reason is logged" tone="red" />
        <Arrow x1={520} y1={145} x2={548} y2={145} />
        <Arrow x1={520} y1={233} x2={548} y2={233} />
        <rect x="32" y="340" width="656" height="24" rx="5" className="diagram-note violet" />
        <text x="44" y="356" className="diagram-note-text">Risk checks use live local account and broker state, not assumptions from the cloud.</text>
      </svg>
    </Frame>
  );
}

export function TradeManagementDiagram() {
  const nodes = [
    ["Entry", "Order filled", "neutral"],
    ["Partial TP", "Configured close", "violet"],
    ["Breakeven", "Stop protected", "green"],
    ["Monitoring", "Local position poll", "neutral"],
    ["Close / exit", "Final event logged", "red"],
  ] as const;
  return (
    <Frame title="Trade management" caption="Position lifecycle after entry">
      <svg viewBox="0 0 820 230" role="img" aria-labelledby="trade-management-title">
        <title id="trade-management-title">Trade lifecycle from entry through partial take profit, breakeven, monitoring, and final close</title>
        <line x1="82" y1="110" x2="738" y2="110" className="diagram-line" aria-hidden="true" />
        {nodes.map(([label, sub, tone], i) => {
          const x = 28 + i * 158;
          return (
            <g key={label}>
              <circle cx={x + 58} cy="110" r="7" className={`diagram-point ${tone}`} />
              <rect x={x} y="36" width="116" height="48" rx="7" className={`diagram-node ${tone}`} />
              <text x={x + 12} y="55" className="diagram-label">{label}</text>
              <text x={x + 12} y="72" className="diagram-sub">{sub}</text>
              <line x1={x + 58} y1="84" x2={x + 58} y2="103" className="diagram-line" />
            </g>
          );
        })}
        <rect x="28" y="160" width="748" height="28" rx="5" className="diagram-note violet" />
        <text x="42" y="178" className="diagram-note-text">Open positions remain locally manageable even when cloud services are unavailable.</text>
      </svg>
    </Frame>
  );
}

export function ManualVsControlledDiagram() {
  const rows = [
    ["Signal arrives", "User must be at the desk to act", "Agent receives and validates instantly"],
    ["Position sizing", "Calculated manually under pressure", "Risk % applied to live balance automatically"],
    ["Order placement", "Entered by hand into MT5", "Submitted via local API connection"],
    ["Stop management", "Moved to breakeven manually or skipped", "Triggered automatically at TP1 level"],
    ["Partial close", "Executed inconsistently", "Closed at configured percentage at TP1"],
    ["Event logging", "Notes or nothing", "Full event record in dashboard"],
  ];
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-card)", overflow: "hidden" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        borderBottom: "1px solid var(--line)",
        background: "rgba(255,255,255,.025)",
      }}>
        {["Step", "Manual execution", "Apex Quantel"].map((h, i) => (
          <div key={h} style={{
            padding: "9px 14px",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".10em",
            textTransform: "uppercase",
            color: i === 1 ? "var(--danger)" : i === 2 ? "var(--success)" : "var(--muted)",
            borderRight: i < 2 ? "1px solid var(--line)" : "none",
          }}>{h}</div>
        ))}
      </div>
      {rows.map(([step, manual, controlled], i) => (
        <div key={step} style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,.04)" : "none",
        }}>
          <div style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: "var(--text-soft)", borderRight: "1px solid var(--line)" }}>{step}</div>
          <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--muted)", borderRight: "1px solid var(--line)", background: "var(--danger-bg)" }}>{manual}</div>
          <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--muted)", background: "var(--success-bg)" }}>{controlled}</div>
        </div>
      ))}
    </div>
  );
}
