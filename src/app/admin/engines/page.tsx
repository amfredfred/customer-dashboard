"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, SectionHead } from "@/components/metric-detail";
import { getBrowserSupabase } from "@/lib/supabase-singleton";
import { X, Zap } from "lucide-react";
import { EngineIcon, ErrorIcon, WarningIcon } from "@/components/icons";
import { RefreshIcon } from "@/components/icons";

type EngineRow = {
  id: string;
  engine_id: string;
  device_name: string;
  engine_version: string;
  platform: Record<string, unknown>;
  status: string;
  activated_at: string;
  last_seen_at: string | null;
  license_id: string;
  license_status: string | null;
  license_expires_at: string | null;
  owner_email: string | null;
  connection_state: "online" | "degraded" | "offline";
};

const STATE_STYLE: Record<string, { dot: string; label: string }> = {
  online:   { dot: "#3ddc97", label: "Online" },
  degraded: { dot: "#f5b942", label: "Degraded" },
  offline:  { dot: "#f43f5e", label: "Offline" },
};

function fmtAgo(v: string | null) {
  if (!v) return "Never";
  const s = Math.floor((Date.now() - Date.parse(v)) / 1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

type CommandType = "command.pause" | "command.resume" | "command.emergency_stop";

function CommandPanel({ engineId, onClose, token }: {
  engineId: string; onClose: () => void; token: string;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function send(commandType: CommandType) {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/engines/${engineId}/command`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ command_type: commandType }),
      });
      const body = await res.json() as { status?: string; error?: string };
      if (res.ok) {
        setResult({ ok: true, msg: `${commandType.replace("command.", "")} — ${body.status ?? "sent"}` });
      } else {
        setResult({ ok: false, msg: body.error ?? "Failed" });
      }
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  const CMDS: { type: CommandType; label: string; tone: string }[] = [
    { type: "command.pause",          label: "Pause",          tone: "warn" },
    { type: "command.resume",         label: "Resume",         tone: "good" },
    { type: "command.emergency_stop", label: "Emergency Stop", tone: "danger" },
  ];

  const toneStyle = (t: string) =>
    t === "warn"   ? { bg: "var(--warning-bg)", border: "var(--warning-border)", color: "var(--warning)" }
    : t === "good" ? { bg: "var(--success-bg)", border: "var(--success-border)", color: "var(--success)" }
    :                { bg: "var(--danger-bg)",  border: "var(--danger-border)",  color: "var(--danger)"  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: "rgba(0,0,0,.75)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden"
           style={{ background: "#0e1015", border: "1px solid rgba(255,255,255,.1)" }}>
        <div className="p-5 border-b border-white/[.07] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
               style={{ background: "rgba(138,180,255,.08)", border: "1px solid rgba(138,180,255,.2)" }}>
            <Zap size={14} style={{ color: "var(--info)" }} />
          </div>
          <div>
            <div className="font-semibold text-sm">Dispatch Command</div>
            <div className="text-[11px] muted font-mono">{engineId.slice(0, 20)}…</div>
          </div>
          <button onClick={onClose} className="ml-auto muted hover:text-white"><X size={15} /></button>
        </div>
        <div className="p-5 space-y-2">
          {result && (
            <div className="text-xs px-3 py-2 rounded-lg mb-3"
                 style={{
                   background: result.ok ? "var(--success-bg)" : "var(--danger-bg)",
                   border: `1px solid ${result.ok ? "var(--success-border)" : "var(--danger-border)"}`,
                   color: result.ok ? "var(--success)" : "var(--danger)",
                 }}>
              {result.msg}
            </div>
          )}
          {CMDS.map(({ type, label, tone }) => {
            const s = toneStyle(tone);
            return (
              <button
                key={type}
                disabled={busy}
                onClick={() => void send(type)}
                className="w-full text-sm py-2.5 px-4 rounded-lg font-medium transition-opacity disabled:opacity-50"
                style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function AdminEnginesPage() {
  const [rows, setRows] = useState<EngineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [commandTarget, setCommandTarget] = useState<EngineRow | null>(null);

  const loadToken = useCallback(async () => {
    const sb = getBrowserSupabase();
    const { data: { session } } = await sb!.auth.getSession();
    const t = session?.access_token ?? "";
    setToken(t);
    return t;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const tok = await loadToken();
    try {
      const res = await fetch("/api/admin/engines", { headers: { Authorization: `Bearer ${tok}` } });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      setRows(await res.json() as EngineRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [loadToken]);

  useEffect(() => { void load(); }, [load]);

  const online  = rows.filter((r) => r.connection_state === "online").length;
  const offline = rows.filter((r) => r.connection_state === "offline").length;

  return (
    <div className="page-wrap">
      {commandTarget && (
        <CommandPanel
          engineId={commandTarget.engine_id}
          token={token}
          onClose={() => setCommandTarget(null)}
        />
      )}

      <PageHeader
        eyebrow="Admin"
        title="All Engines"
        description={`${rows.length} registered — ${online} online, ${offline} offline`}
        right={
          <button className="btn-ghost flex items-center gap-1.5" onClick={() => void load()}>
            <RefreshIcon size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        }
      />

      {error && (
        <div className="card mb-4 p-3 text-sm flex items-center gap-2"
             style={{ borderColor: "var(--danger-border)", color: "var(--danger)" }}>
          <ErrorIcon size={14} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={13} /></button>
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="text-sm muted">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center text-sm muted">No engines found</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[.07]" style={{ color: "var(--muted)" }}>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide">Engine</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide">State</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide hidden md:table-cell">Owner</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide hidden lg:table-cell">Version</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide hidden lg:table-cell">Last Seen</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const st = STATE_STYLE[row.connection_state] ?? STATE_STYLE.offline;
                return (
                  <tr key={row.id} className="border-b border-white/[.04] hover:bg-white/[.015] transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.device_name || "Unnamed"}</div>
                      <div className="text-[11px] muted font-mono">{row.engine_id.slice(0, 16)}…</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: st.dot }} />
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs muted hidden md:table-cell">{row.owner_email ?? "—"}</td>
                    <td className="px-4 py-3 text-xs font-mono muted hidden lg:table-cell">{row.engine_version}</td>
                    <td className="px-4 py-3 text-xs muted hidden lg:table-cell">{fmtAgo(row.last_seen_at)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setCommandTarget(row)}
                        className="text-[11px] px-2.5 py-1 rounded-md transition-colors flex items-center gap-1"
                        style={{
                          background: "rgba(138,180,255,.07)",
                          border: "1px solid rgba(138,180,255,.2)",
                          color: "var(--info)",
                        }}
                      >
                        <Zap size={11} />
                        Command
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
