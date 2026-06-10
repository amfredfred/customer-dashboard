"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/metric-detail";
import { adminFetch } from "@/lib/admin-api";
import { Copy, X } from "lucide-react";
import { SuccessIcon, ErrorIcon, LicenseKeyIcon, RefreshIcon } from "@/components/icons";

type LicenseRow = {
  id: string;
  status: string;
  max_devices: number;
  expires_at: string | null;
  created_at: string;
  owner_user_id: string;
  owner_email: string;
  symbols: string[];
};

function fmtDate(v: string | null) {
  if (!v) return "Never";
  return new Date(v).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; style: React.CSSProperties }> = {
    active:    { label: "Active",    style: { color: "var(--success)", background: "var(--success-bg)", border: "1px solid var(--success-border)" } },
    suspended: { label: "Suspended", style: { color: "var(--warning)", background: "var(--warning-bg)", border: "1px solid var(--warning-border)" } },
    expired:   { label: "Expired",   style: { color: "var(--danger)",  background: "var(--danger-bg)",  border: "1px solid var(--danger-border)"  } },
  };
  const { label, style } = map[status] ?? { label: status, style: {} };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide" style={style}>
      {label}
    </span>
  );
}

function KeyRevealModal({ rawKey, onClose }: {
  rawKey: string; onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  function copy() {
    void navigator.clipboard.writeText(rawKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: "rgba(0,0,0,.75)", backdropFilter: "blur(4px)" }}>
      <div className="relative w-full max-w-lg rounded-2xl overflow-hidden"
           style={{ background: "#0e1015", border: "1px solid rgba(255,255,255,.1)", boxShadow: "0 24px 64px rgba(0,0,0,.7)" }}>
        <div className="p-6 border-b border-white/[.07] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
               style={{ background: "var(--success-bg)", border: "1px solid var(--success-border)" }}>
            <LicenseKeyIcon size={16} style={{ color: "var(--success)" }} />
          </div>
          <div>
            <div className="font-semibold">Activation Key Issued</div>
            <div className="text-xs muted">Copy this key now &mdash; it will not be shown again</div>
          </div>
          <button onClick={onClose} className="ml-auto muted hover:text-white"><X size={16} /></button>
        </div>
        <div className="p-6">
          <div className="rounded-lg p-3 font-mono text-sm break-all mb-4"
               style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", color: "var(--success)" }}>
            {rawKey}
          </div>
          <button
            onClick={copy}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: copied ? "var(--success-bg)" : "rgba(255,255,255,.06)",
              border: `1px solid ${copied ? "var(--success-border)" : "rgba(255,255,255,.12)"}`,
              color: copied ? "var(--success)" : "var(--text)",
            }}
          >
            {copied ? <SuccessIcon size={15} /> : <Copy size={15} />}
            {copied ? "Copied!" : "Copy to clipboard"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, confirmLabel, danger, onConfirm, onClose }: {
  title: string; message: string; confirmLabel: string; danger?: boolean;
  onConfirm: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: "rgba(0,0,0,.75)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden"
           style={{ background: "#0e1015", border: "1px solid rgba(255,255,255,.1)" }}>
        <div className="p-5">
          <div className="font-semibold mb-1">{title}</div>
          <div className="text-sm muted">{message}</div>
        </div>
        <div className="p-4 border-t border-white/[.07] flex gap-2 justify-end">
          <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
          <button
            onClick={onConfirm}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: danger ? "rgba(244,63,94,.15)" : "rgba(61,220,151,.1)",
              border: `1px solid ${danger ? "rgba(244,63,94,.35)" : "rgba(61,220,151,.3)"}`,
              color: danger ? "var(--danger)" : "var(--success)",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminLicensesPage() {
  const [rows, setRows] = useState<LicenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modals
  const [keyModal, setKeyModal] = useState<{ licenseId: string; rawKey: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string; message: string; confirmLabel: string; danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch("/admin/licenses");
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      setRows(await res.json() as LicenseRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function patch(id: string, body: Record<string, unknown>) {
    setActionError(null);
    const res = await adminFetch(`/admin/licenses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setActionError((await res.json()).error ?? "Action failed");
      return false;
    }
    await load();
    return true;
  }

  async function issueKey(id: string) {
    setActionError(null);
    const res = await adminFetch(`/admin/licenses/${id}/keys`, { method: "POST" });
    const body = await res.json() as { key?: string; error?: string };
    if (!res.ok) { setActionError(body.error ?? "Failed to issue key"); return; }
    setKeyModal({ licenseId: id, rawKey: body.key ?? "" });
    await load();
  }

  async function revokeKey(id: string) {
    setActionError(null);
    const res = await adminFetch(`/admin/licenses/${id}/keys`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setActionError(body.error ?? "Failed to revoke key");
      return;
    }
    await load();
  }

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="Admin"
        title="All Licenses"
        description={`${rows.length} license${rows.length !== 1 ? "s" : ""} across all customers`}
        right={
          <button className="btn btn-ghost btn-sm" onClick={() => void load()}>
            <RefreshIcon size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        }
      />

      {(error || actionError) && (
        <div className="surface mb-4 p-3 text-sm flex items-center gap-2"
             style={{ borderColor: "var(--danger-border)", color: "var(--danger)" }}>
          <ErrorIcon size={14} />
          {error ?? actionError}
          <button onClick={() => { setError(null); setActionError(null); }} className="ml-auto">
            <X size={13} />
          </button>
        </div>
      )}

      {keyModal && (
        <KeyRevealModal
          rawKey={keyModal.rawKey}
          onClose={() => setKeyModal(null)}
        />
      )}
      {confirmModal && (
        <ConfirmModal
          {...confirmModal}
          onClose={() => setConfirmModal(null)}
        />
      )}

      {loading && rows.length === 0 ? (
        <div className="text-sm muted">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="surface p-8 text-center text-sm muted">No licenses found</div>
      ) : (
        <div className="surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[.07]" style={{ color: "var(--muted)" }}>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide">Customer</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide hidden md:table-cell">Symbols</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide hidden lg:table-cell">Expires</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide hidden xl:table-cell">Devices</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-white/[.04] hover:bg-white/[.015] transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.owner_email}</div>
                    <div className="text-[11px] muted font-mono">{row.id.slice(0, 8)}…</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {row.symbols.map((s) => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                              style={{ background: "rgba(138,180,255,.07)", color: "var(--info)" }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs muted hidden lg:table-cell">{fmtDate(row.expires_at)}</td>
                  <td className="px-4 py-3 text-xs muted hidden xl:table-cell">{row.max_devices}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end flex-wrap">
                      {/* Suspend / Reactivate */}
                      {row.status === "active" ? (
                        <button
                          className="text-[11px] px-2.5 py-1 rounded-md transition-colors"
                          style={{ background: "var(--warning-bg)", border: "1px solid var(--warning-border)", color: "var(--warning)" }}
                          onClick={() => setConfirmModal({
                            title: "Suspend License",
                            message: `Suspend ${row.owner_email}? Their engine will disconnect on next heartbeat.`,
                            confirmLabel: "Suspend",
                            danger: true,
                            onConfirm: () => { setConfirmModal(null); void patch(row.id, { status: "suspended" }); },
                          })}
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          className="text-[11px] px-2.5 py-1 rounded-md transition-colors"
                          style={{ background: "var(--success-bg)", border: "1px solid var(--success-border)", color: "var(--success)" }}
                          onClick={() => setConfirmModal({
                            title: "Reactivate License",
                            message: `Reactivate license for ${row.owner_email}?`,
                            confirmLabel: "Reactivate",
                            onConfirm: () => { setConfirmModal(null); void patch(row.id, { status: "active" }); },
                          })}
                        >
                          Reactivate
                        </button>
                      )}

                      {/* Issue key */}
                      <button
                        className="text-[11px] px-2.5 py-1 rounded-md transition-colors"
                        style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "var(--text-soft)" }}
                        onClick={() => setConfirmModal({
                          title: "Issue Activation Key",
                          message: `Issue a new activation key for ${row.owner_email}? The previous key will be replaced.`,
                          confirmLabel: "Issue Key",
                          onConfirm: () => { setConfirmModal(null); void issueKey(row.id); },
                        })}
                      >
                        Issue Key
                      </button>

                      {/* Revoke key */}
                      <button
                        className="text-[11px] px-2.5 py-1 rounded-md transition-colors"
                        style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", color: "var(--danger)" }}
                        onClick={() => setConfirmModal({
                          title: "Revoke Key",
                          message: `Revoke the activation key for ${row.owner_email}? No new activations will be possible until a new key is issued.`,
                          confirmLabel: "Revoke",
                          danger: true,
                          onConfirm: () => { setConfirmModal(null); void revokeKey(row.id); },
                        })}
                      >
                        Revoke
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
