"use client";

import { useGateway, type EngineRegistryEntry, type EngineHealthState } from "@/components/gateway-provider";
import { Page, SectionRule } from "@/components/ui/page";
import { StatusBadge, type StatusKind } from "@/components/ui/status-badge";
import { Alert } from "@/components/ui/alert";

/* ── helpers ────────────────────────────────────────────────────────────── */

function healthKind(state: EngineHealthState): StatusKind {
  switch (state) {
    case "online":  return "online";
    case "stale":   return "degraded";
    case "offline": return "offline";
    case "error":   return "expired";
    default:        return "none";
  }
}

function healthLabel(state: EngineHealthState): string {
  return state.charAt(0).toUpperCase() + state.slice(1);
}

function ago(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - Date.parse(iso);
  if (diff < 0) return "just now";
  if (diff < 5_000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

function yesno(v: unknown): string {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return "—";
}

/* ── card ────────────────────────────────────────────────────────────────── */

function SourceCard({ entry }: { entry: EngineRegistryEntry }) {
  const aw = entry.latestAwareness ?? {};
  const sourceKey = aw.source_key ? String(aw.source_key) : entry.sourceKey;
  const broker = aw.broker ? String(aw.broker) : entry.account?.server ?? "—";
  const isStale = entry.healthState === "stale";
  const isOffline = entry.healthState === "offline" || entry.healthState === "unknown";

  return (
    <div
      style={{
        background: "var(--surface-2)",
        border: `1px solid ${isOffline ? "rgba(239,68,68,.25)" : isStale ? "rgba(234,179,8,.2)" : "var(--line-soft)"}`,
        borderRadius: "var(--radius-md)",
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", fontFamily: "var(--font-mono)" }}>
            {sourceKey}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-soft)", marginTop: "2px" }}>
            {broker}
          </div>
        </div>
        <StatusBadge kind={healthKind(entry.healthState)} label={healthLabel(entry.healthState)} />
      </div>

      {/* Warnings */}
      {isStale && (
        <div style={{ fontSize: "11px", color: "rgb(234,179,8)", background: "rgba(234,179,8,.07)", borderRadius: "var(--radius-sm)", padding: "6px 10px" }}>
          Engine is stale — heartbeat has not been received recently.
        </div>
      )}
      {isOffline && (
        <div style={{ fontSize: "11px", color: "rgb(239,68,68)", background: "rgba(239,68,68,.07)", borderRadius: "var(--radius-sm)", padding: "6px 10px" }}>
          Engine is offline — not connected to the gateway.
        </div>
      )}
      {aw.autotrading_enabled === false && (
        <div style={{ fontSize: "11px", color: "rgb(234,179,8)", background: "rgba(234,179,8,.07)", borderRadius: "var(--radius-sm)", padding: "6px 10px" }}>
          Autotrading is disabled on this terminal.
        </div>
      )}
      {aw.terminal_connected === false && (
        <div style={{ fontSize: "11px", color: "rgb(239,68,68)", background: "rgba(239,68,68,.07)", borderRadius: "var(--radius-sm)", padding: "6px 10px" }}>
          MT5 terminal is not connected.
        </div>
      )}
      {entry.lastError && (
        <div style={{ fontSize: "11px", color: "rgb(239,68,68)", background: "rgba(239,68,68,.07)", borderRadius: "var(--radius-sm)", padding: "6px 10px" }}>
          Last error: {entry.lastError}
        </div>
      )}

      {/* Detail grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
        <Row label="Account" value={entry.account?.login ?? "—"} />
        <Row label="Mode" value={entry.account?.mode ?? "—"} />
        <Row label="Server" value={entry.account?.server ?? "—"} />
        <Row label="Runtime" value={aw.runtime_state ? String(aw.runtime_state) : "—"} />
        <Row label="Autotrading" value={yesno(aw.autotrading_enabled)} />
        <Row label="Terminal" value={aw.terminal_connected === true ? "Connected" : aw.terminal_connected === false ? "Disconnected" : "—"} />
        <Row label="Engine version" value={entry.engineVersion ?? "—"} />
        <Row label="Device name" value={entry.deviceName ?? "—"} />
        <Row label="Last seen" value={ago(entry.lastSeenAt)} />
        <Row label="Last metrics" value={ago(entry.lastMetricsAt)} />
        <Row label="Last awareness" value={ago(entry.lastAwarenessAt)} />
        <Row label="Connected" value={ago(entry.connectedAt)} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "2px" }}>
        {label}
      </div>
      <div style={{ fontSize: "12px", color: "var(--text-soft)", fontFamily: "var(--font-mono)" }}>
        {value}
      </div>
    </div>
  );
}

/* ── page ────────────────────────────────────────────────────────────────── */

export default function ExecutionSourcesPage() {
  const { engineRegistry, status } = useGateway();

  const online  = engineRegistry.filter(e => e.healthState === "online").length;
  const stale   = engineRegistry.filter(e => e.healthState === "stale").length;
  const offline = engineRegistry.filter(e => e.healthState === "offline" || e.healthState === "unknown").length;
  const errored = engineRegistry.filter(e => e.healthState === "error").length;

  return (
    <Page
      eyebrow="Monitor"
      title="Execution Sources"
      description="All known execution engines connected to the gateway. Each source represents one broker terminal."
    >
      {status !== "authenticated" && (
        <Alert tone="warning" title="Gateway not connected">
          Execution source data requires an active gateway connection.
        </Alert>
      )}

      {status === "authenticated" && engineRegistry.length === 0 && (
        <Alert tone="warning" title="No execution sources">
          No execution engines have connected to the gateway yet. Start an AQ Agent to see it here.
        </Alert>
      )}

      {engineRegistry.length > 0 && (
        <>
          {/* Summary strip */}
          <div
            style={{
              display: "flex",
              gap: "24px",
              flexWrap: "wrap",
              padding: "10px 0",
              borderBottom: "1px solid var(--line-soft)",
              marginBottom: "4px",
            }}
          >
            <Chip label="Online"  value={online}  color="rgb(61,220,151)" />
            <Chip label="Stale"   value={stale}   color="rgb(234,179,8)" />
            <Chip label="Offline" value={offline} color="rgb(239,68,68)" />
            {errored > 0 && <Chip label="Error" value={errored} color="rgb(239,68,68)" />}
            <Chip label="Total"   value={engineRegistry.length} color="var(--text-soft)" />
          </div>

          <section>
            <SectionRule label="Sources" />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                gap: "12px",
              }}
            >
              {engineRegistry.map(entry => (
                <SourceCard key={entry.sourceKey} entry={entry} />
              ))}
            </div>
          </section>
        </>
      )}
    </Page>
  );
}

function Chip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, display: "inline-block" }} />
      <span style={{ fontSize: "11px", color: "var(--text-soft)" }}>
        {label} <b style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{value}</b>
      </span>
    </div>
  );
}
