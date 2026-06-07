"use client";

import { getBrowserSupabase } from "@/lib/supabase-singleton";
import { useAuth } from "@/components/auth-provider";
import { PageHeader, SectionHead } from "@/components/metric-detail";
import { AlertCircle, CheckCircle, Copy, KeyRound, ShieldCheck, ShieldOff, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

/* ── types ────────────────────────────────────────────────────────────── */
// Real licenses columns: id, owner_user_id, activation_key_hash, status,
//   max_devices, expires_at, created_at, updated_at
type LicenseRow = {
  id: string;
  status: string;
  max_devices: number;
  expires_at: string | null;
};

type LicenseView = LicenseRow & {
  symbols: string[];
  usedDevices: number;
};

/* ── helpers ──────────────────────────────────────────────────────────── */
function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function gatewayHttpBase(): string {
  const wsUrl = process.env.NEXT_PUBLIC_GATEWAY_WS_URL ?? "ws://localhost:4000/dashboard";
  const http = wsUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
  try { return new URL(http).origin; } catch { return "http://localhost:4000"; }
}

/* ── Key reveal modal ─────────────────────────────────────────────────── */
function KeyRevealModal({ licenseId, rawKey, onClose }: {
  licenseId: string;
  rawKey: string;
  onClose: () => void;
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
         style={{ background: "rgba(0,0,0,.7)", backdropFilter: "blur(4px)" }}>
      <div className="relative w-full max-w-lg rounded-2xl overflow-hidden"
           style={{ background: "#0e1015", border: "1px solid rgba(255,255,255,.1)", boxShadow: "0 24px 64px rgba(0,0,0,.7)" }}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3ddc97]/10 border border-[#3ddc97]/25 grid place-items-center shrink-0">
              <KeyRound size={16} className="text-[#3ddc97]" />
            </div>
            <div>
              <div className="font-semibold">New activation key</div>
              <div className="text-xs muted mt-0.5 mono truncate max-w-[240px]">{licenseId}</div>
            </div>
          </div>
          <button onClick={onClose} className="muted hover:text-white mt-0.5">
            <X size={16} />
          </button>
        </div>

        {/* Warning */}
        <div className="mx-6 mb-4 px-4 py-3 rounded-lg"
             style={{ background: "rgba(245,185,66,.08)", border: "1px solid rgba(245,185,66,.2)" }}>
          <div className="text-xs font-bold uppercase tracking-wider text-[#f5b942] mb-1">Copy now — shown once</div>
          <p className="text-xs muted leading-5">
            This key will not be displayed again. TradeRelay stores only the hash.
            Copy it before closing this window.
          </p>
        </div>

        {/* Key display */}
        <div className="mx-6 mb-4">
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg"
               style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)" }}>
            <code className="flex-1 text-sm font-mono text-white break-all select-all leading-6">
              {rawKey}
            </code>
            <button
              onClick={copy}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: copied ? "rgba(61,220,151,.15)" : "rgba(255,255,255,.08)",
                color:      copied ? "#3ddc97" : "rgba(255,255,255,.7)",
                border:     `1px solid ${copied ? "rgba(61,220,151,.3)" : "rgba(255,255,255,.1)"}`,
              }}
            >
              {copied ? <><CheckCircle size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.8)" }}
          >
            I've saved my key
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Confirm revoke dialog ────────────────────────────────────────────── */
function ConfirmRevokeDialog({ onConfirm, onCancel, busy }: {
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: "rgba(0,0,0,.7)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden"
           style={{ background: "#0e1015", border: "1px solid rgba(255,255,255,.1)", boxShadow: "0 24px 64px rgba(0,0,0,.7)" }}>
        <div className="px-6 pt-6 pb-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#f43f5e]/10 border border-[#f43f5e]/25 grid place-items-center shrink-0 mt-0.5">
            <ShieldOff size={16} className="text-[#f43f5e]" />
          </div>
          <div>
            <div className="font-semibold">Revoke activation key?</div>
            <p className="text-xs muted mt-1.5 leading-5">
              The key will be cleared and the license suspended. No new engines can
              activate until you issue a replacement key. Existing engine sessions
              continue until the next heartbeat sweep.
            </p>
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.6)" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{ background: busy ? "rgba(244,63,94,.2)" : "rgba(244,63,94,.15)", border: "1px solid rgba(244,63,94,.35)", color: "#f43f5e" }}
          >
            {busy ? "Revoking…" : "Revoke key"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── page ────────────────────────────────────────────────────────────── */
export default function Licenses() {
  const supabase  = getBrowserSupabase();
  const { session } = useAuth();
  const [licenses, setLicenses] = useState<LicenseView[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  /* key actions */
  const [rotating, setRotating]         = useState<string | null>(null); // licenseId in progress
  const [revoking, setRevoking]         = useState<string | null>(null); // licenseId being revoked
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null); // licenseId awaiting confirm
  const [actionError, setActionError]   = useState<string | null>(null);
  const [issuedKey, setIssuedKey]       = useState<{ licenseId: string; key: string } | null>(null);

  const load = useCallback(async () => {
    if (!supabase) { setError("Supabase is not configured."); setLoading(false); return; }

    const licResult = await supabase
      .from("licenses")
      .select("id,status,max_devices,expires_at")
      .order("id", { ascending: false });

    if (licResult.error) { setError(licResult.error.message); setLoading(false); return; }

    const rows = (licResult.data ?? []) as LicenseRow[];
    const ids  = rows.map(r => r.id);

    const [entResult, devResult] = await Promise.all([
      ids.length
        ? supabase.from("license_symbol_entitlements").select("license_id,symbol").in("license_id", ids)
        : Promise.resolve({ data: [], error: null }),
      ids.length
        ? supabase.from("engine_devices").select("license_id,id").in("license_id", ids)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (entResult.error ?? devResult.error) {
      setError((entResult.error ?? devResult.error)!.message);
      setLoading(false);
      return;
    }

    const symbolsByLicense = new Map<string, string[]>();
    for (const e of (entResult.data ?? []) as { license_id: string; symbol: string }[]) {
      symbolsByLicense.set(e.license_id, [...(symbolsByLicense.get(e.license_id) ?? []), e.symbol]);
    }

    const deviceCountByLicense = new Map<string, number>();
    for (const d of (devResult.data ?? []) as { license_id: string }[]) {
      deviceCountByLicense.set(d.license_id, (deviceCountByLicense.get(d.license_id) ?? 0) + 1);
    }

    setLicenses(rows.map(r => ({
      ...r,
      symbols:     symbolsByLicense.get(r.id) ?? [],
      usedDevices: deviceCountByLicense.get(r.id) ?? 0,
    })));
    setError(null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  // 3.14 — Live push: refresh when any of the user's licenses change in the DB.
  // Fires for key rotation, revocation, subscription status changes, etc.
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("licenses-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "licenses" }, () => {
        void load();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, load]);

  /* ── key actions ────────────────────────────────────────────────────── */
  async function rotateKey(licenseId: string) {
    if (!session?.access_token) { setActionError("Not authenticated."); return; }
    setActionError(null);
    setRotating(licenseId);
    try {
      const res = await fetch(`${gatewayHttpBase()}/licenses/${licenseId}/keys`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      const { key } = await res.json() as { key: string };
      setIssuedKey({ licenseId, key });
      void load(); // refresh status
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Key rotation failed.");
    } finally {
      setRotating(null);
    }
  }

  async function revokeKey(licenseId: string) {
    if (!session?.access_token) { setActionError("Not authenticated."); return; }
    setActionError(null);
    setRevoking(licenseId);
    try {
      const res = await fetch(`${gatewayHttpBase()}/licenses/${licenseId}/keys`, {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      setConfirmRevoke(null);
      void load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Key revocation failed.");
      setConfirmRevoke(null);
    } finally {
      setRevoking(null);
    }
  }

  /* ── render ─────────────────────────────────────────────────────────── */
  return (
    <div className="page-wrap space-y-2">
      <PageHeader
        eyebrow="Access control"
        title="Licenses & Keys"
        description="Activation keys are issued server-side and displayed once. TradeRelay stores only the keyed hash — the browser never generates, derives, or holds raw keys."
      />

      {/* Loading */}
      {loading && (
        <div className="space-y-3 pt-4">
          {Array.from({ length: 1 }).map((_, i) => (
            <div key={i} className="panel overflow-hidden">
              <div className="panel-head">
                <div><div className="skeleton h-4 w-40 mb-2" /><div className="skeleton h-2.5 w-56" /></div>
                <div className="skeleton h-5 w-16 rounded" />
              </div>
              <div className="panel-body grid grid-cols-2 sm:grid-cols-4 gap-5">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j}><div className="skeleton h-2 w-16 mb-2" /><div className="skeleton h-4 w-20" /></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load error */}
      {error && !loading && (
        <div className="panel p-4 mt-2" style={{ borderColor: "rgba(244,63,94,.3)", background: "rgba(244,63,94,.05)" }}>
          <div className="flex items-center gap-2 text-[#f43f5e] text-sm font-semibold">
            <AlertCircle size={14} /> {error}
          </div>
        </div>
      )}

      {/* Action error */}
      {actionError && (
        <div className="panel p-4 mt-2 flex items-center justify-between gap-3"
             style={{ borderColor: "rgba(244,63,94,.3)", background: "rgba(244,63,94,.05)" }}>
          <div className="flex items-center gap-2 text-[#f43f5e] text-sm">
            <AlertCircle size={14} /> {actionError}
          </div>
          <button onClick={() => setActionError(null)} className="muted hover:text-white shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {/* No Supabase */}
      {!supabase && !loading && (
        <div className="panel p-5 mt-2" style={{ borderColor: "rgba(245,185,66,.3)" }}>
          <div className="text-xs font-bold uppercase tracking-wider text-[#f5b942]">Supabase required</div>
          <p className="muted text-xs mt-2 leading-5">Configure the public Supabase environment variables to load license data.</p>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && supabase && licenses.length === 0 && (
        <div className="panel state-block mt-4">
          <ShieldCheck size={28} className="text-white/10 mb-2" />
          <div className="font-medium">No licenses found</div>
          <p className="muted text-xs max-w-xs">
            Purchase a plan from the Billing page to receive a license.
          </p>
        </div>
      )}

      {/* License cards */}
      {!loading && licenses.map(lic => {
        const isActive   = lic.status === "active";
        const isSuspended = lic.status === "suspended";
        const statusBadge = isActive ? "badge-green" : isSuspended ? "badge-warn" : lic.status === "expired" ? "badge-warn" : "badge-red";
        const isRotating  = rotating === lic.id;
        const canAct      = Boolean(session) && !isRotating && !revoking;

        return (
          <div key={lic.id} className="panel overflow-hidden mt-4">
            {/* Header */}
            <div className="panel-head flex-col sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#3ddc97]/10 border border-[#3ddc97]/25 grid place-items-center shrink-0">
                  <ShieldCheck size={16} className="text-[#3ddc97]" />
                </div>
                <div>
                  <div className="font-semibold">TradeRelay License</div>
                  <div className="text-xs muted mt-0.5 mono">{lic.id}</div>
                </div>
              </div>
              <span className={`badge ${statusBadge} w-fit`}>{lic.status}</span>
            </div>

            {/* Details */}
            <div className="panel-body grid grid-cols-2 sm:grid-cols-4 gap-5 text-sm">
              <div>
                <div className="muted text-xs">Max devices</div>
                <div className="mt-2 mono font-medium">{lic.max_devices}</div>
              </div>
              <div>
                <div className="muted text-xs">Used devices</div>
                <div className="mt-2 mono font-medium">{lic.usedDevices}</div>
              </div>
              <div>
                <div className="muted text-xs">Symbols</div>
                <div className="mt-2 mono font-medium break-words text-xs">
                  {lic.symbols.length > 0 ? lic.symbols.join(", ") : "—"}
                </div>
              </div>
              <div>
                <div className="muted text-xs">Expires</div>
                <div className="mt-2 mono font-medium">{fmtDate(lic.expires_at)}</div>
              </div>
            </div>

            {/* Key section */}
            <div className="border-t border-white/[.06]">
              <div className="px-5 pt-4 pb-5 space-y-3">
                <SectionHead label="Activation key" />

                <div className="panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">
                      {isActive ? "Key hash on file" : isSuspended ? "Key revoked — license suspended" : "No key on file"}
                    </div>
                    <div className="text-xs muted mt-0.5 leading-5">
                      {isActive
                        ? "The raw key was shown once at issuance. Rotate to generate a replacement — the old key is immediately invalidated."
                        : isSuspended
                        ? "Issue a new key to reactivate this license and allow engine activations."
                        : "Issue a key to enable engine activations against this license."}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => void rotateKey(lic.id)}
                      disabled={!canAct}
                      className="pill text-xs"
                      style={{ opacity: canAct ? 1 : 0.45, cursor: canAct ? "pointer" : "not-allowed" }}
                    >
                      <KeyRound size={12} />
                      {isRotating ? "Issuing…" : isActive ? "Rotate" : "Issue key"}
                    </button>
                    {isActive && (
                      <button
                        onClick={() => { setActionError(null); setConfirmRevoke(lic.id); }}
                        disabled={!canAct}
                        className="pill text-xs"
                        style={{
                          opacity: canAct ? 1 : 0.45,
                          cursor:  canAct ? "pointer" : "not-allowed",
                          color:   "rgba(244,63,94,.8)",
                          borderColor: "rgba(244,63,94,.25)",
                        }}
                      >
                        <ShieldOff size={12} /> Revoke
                      </button>
                    )}
                  </div>
                </div>

                {/* Key security notice */}
                <div className="panel p-4" style={{ borderColor: "rgba(245,185,66,.2)", background: "rgba(245,185,66,.04)" }}>
                  <div className="text-xs font-bold uppercase tracking-wider text-[#f5b942] mb-2">Key security</div>
                  <p className="muted text-xs leading-5">
                    Raw keys are shown once at issuance and never stored in plain text.
                    TradeRelay stores only a keyed HMAC hash. The browser never generates or hashes activation keys.
                    Rotating immediately invalidates the previous key — re-activate any affected engines with the new key.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Modals */}
      {issuedKey && (
        <KeyRevealModal
          licenseId={issuedKey.licenseId}
          rawKey={issuedKey.key}
          onClose={() => setIssuedKey(null)}
        />
      )}

      {confirmRevoke && (
        <ConfirmRevokeDialog
          onConfirm={() => void revokeKey(confirmRevoke)}
          onCancel={() => setConfirmRevoke(null)}
          busy={revoking === confirmRevoke}
        />
      )}
    </div>
  );
}
