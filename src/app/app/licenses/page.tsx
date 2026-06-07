"use client";

import { createBrowserSupabase } from "@/lib/supabase";
import { AlertCircle, CheckCircle, Clock, KeyRound, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

/* ── types ────────────────────────────────────────────────────────────── */
type LicenseRow = {
  id: string;
  status: string;
  max_devices: number;
  expires_at: string | null;
  issued_at?: string | null;
  plan_name?: string;
  plan_id?: string;
};

type LicenseView = LicenseRow & {
  symbols: string[];
  usedDevices: number;
  hasKey: boolean;
  keyIssuedAt: string | null;
};

/* ── helpers ──────────────────────────────────────────────────────────── */
function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function SectionRule({ label }: { label: string }) {
  return (
    <div className="section-rule mt-6 mb-4">
      <span className="section-rule-bar" />
      <span className="section-rule-label">{label}</span>
      <span className="section-rule-line" />
    </div>
  );
}

/* ── page ────────────────────────────────────────────────────────────── */
export default function Licenses() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [licenses, setLicenses] = useState<LicenseView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }

    const licResult = await supabase
      .from("licenses")
      .select("id,status,max_devices,expires_at,issued_at,plan_name,plan_id")
      .order("issued_at", { ascending: false });

    if (licResult.error) { setError(licResult.error.message); setLoading(false); return; }

    const rows = (licResult.data ?? []) as LicenseRow[];
    const ids  = rows.map(r => r.id);

    const [entResult, devResult, keyResult] = await Promise.all([
      ids.length
        ? supabase.from("license_symbol_entitlements").select("license_id,symbol").in("license_id", ids)
        : Promise.resolve({ data: [], error: null }),
      ids.length
        ? supabase.from("engine_devices").select("license_id,id").in("license_id", ids)
        : Promise.resolve({ data: [], error: null }),
      ids.length
        ? supabase
            .from("license_activation_keys")
            .select("license_id,issued_at")
            .in("license_id", ids)
            .order("issued_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    const err = entResult.error ?? devResult.error;
    if (err) { setError(err.message); setLoading(false); return; }

    const symbolsByLicense = new Map<string, string[]>();
    for (const e of (entResult.data ?? []) as { license_id: string; symbol: string }[]) {
      symbolsByLicense.set(e.license_id, [...(symbolsByLicense.get(e.license_id) ?? []), e.symbol]);
    }

    const deviceCountByLicense = new Map<string, number>();
    for (const d of (devResult.data ?? []) as { license_id: string }[]) {
      deviceCountByLicense.set(d.license_id, (deviceCountByLicense.get(d.license_id) ?? 0) + 1);
    }

    const keyByLicense = new Map<string, string | null>();
    for (const k of (keyResult.data ?? []) as { license_id: string; issued_at: string | null }[]) {
      if (!keyByLicense.has(k.license_id)) keyByLicense.set(k.license_id, k.issued_at);
    }

    setLicenses(
      rows.map(r => ({
        ...r,
        symbols:     symbolsByLicense.get(r.id) ?? [],
        usedDevices: deviceCountByLicense.get(r.id) ?? 0,
        hasKey:      keyByLicense.has(r.id),
        keyIssuedAt: keyByLicense.get(r.id) ?? null,
      }))
    );
    setError(null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="p-5 md:p-8 max-w-6xl mx-auto page-in space-y-2">
      {/* Header */}
      <div className="text-[10px] uppercase tracking-[.17em] muted">Access control</div>
      <h1 className="text-3xl font-semibold tracking-tight">Licenses & Activation Keys</h1>
      <p className="muted text-sm leading-5">
        Keys are generated server-side and displayed once. TradeRelay stores only their keyed hash.
        The browser never generates, derives, or persists raw activation keys.
      </p>

      {/* Loading */}
      {loading && (
        <div className="pt-6 space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="panel p-5">
              <div className="skeleton h-3 w-32 mb-4" />
              <div className="skeleton h-5 w-48 mb-3" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j}><div className="skeleton h-2 w-16 mb-2" /><div className="skeleton h-4 w-24" /></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="panel mt-4 p-4 border-[#f43f5e]/30 bg-[#f43f5e]/05">
          <div className="flex items-center gap-2 text-[#f43f5e] text-sm font-semibold">
            <AlertCircle size={14} /> {error}
          </div>
        </div>
      )}

      {/* No supabase */}
      {!supabase && !loading && (
        <div className="panel mt-4 p-5 border-[#f5b942]/30">
          <div className="text-xs font-bold uppercase tracking-wider text-[#f5b942]">Supabase required</div>
          <p className="muted text-xs mt-2 leading-5">Configure the public Supabase environment variables to load license data.</p>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && supabase && licenses.length === 0 && (
        <div className="panel mt-6 state-block">
          <ShieldCheck size={28} className="text-white/10 mb-2" />
          <div className="font-medium">No licenses found</div>
          <p className="muted text-xs max-w-xs">
            Purchase a plan from the Billing page to receive your first license and activation key.
          </p>
        </div>
      )}

      {/* License cards */}
      {!loading && licenses.map(lic => {
        const planLabel = String(
          (lic as Record<string,unknown>).plan_name ??
          (lic as Record<string,unknown>).plan_id ??
          "License"
        );
        const isActive = lic.status === "active";
        const statusBadge = isActive ? "badge-green" : lic.status === "expired" ? "badge-warn" : "badge-red";

        return (
          <div key={lic.id} className="panel overflow-hidden mt-6">
            {/* Card header */}
            <div className="p-5 border-b border-white/[.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#3ddc97]/10 border border-[#3ddc97]/25 grid place-items-center shrink-0">
                  <ShieldCheck size={16} className="text-[#3ddc97]" />
                </div>
                <div>
                  <div className="font-semibold">{planLabel}</div>
                  <div className="text-xs muted mt-0.5 mono">{lic.id}</div>
                </div>
              </div>
              <span className={`badge ${statusBadge} w-fit`}>{lic.status}</span>
            </div>

            {/* License details */}
            <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-5 text-sm">
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
                <div className="mt-2 mono font-medium break-words">
                  {lic.symbols.length > 0 ? lic.symbols.join(", ") : "—"}
                </div>
              </div>
              <div>
                <div className="muted text-xs">Expires</div>
                <div className="mt-2 mono font-medium">
                  {lic.expires_at ? fmtDate(lic.expires_at) : "No expiry"}
                </div>
              </div>
            </div>

            {/* Activation key section */}
            <div className="border-t border-white/[.07]">
              <SectionRule label="Activation key" />
              <div className="px-5 pb-5 space-y-3">
                {lic.hasKey ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 panel p-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle size={15} className="text-[#3ddc97] shrink-0" />
                      <div>
                        <div className="text-sm font-medium">Key previously issued</div>
                        <div className="text-xs muted mt-0.5 flex items-center gap-1">
                          <Clock size={11} /> Issued {fmtDate(lic.keyIssuedAt)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled
                        className="pill opacity-50 cursor-not-allowed text-xs"
                        title="Backend key rotation endpoint required"
                      >
                        <KeyRound size={12} /> Rotate key
                      </button>
                      <button
                        disabled
                        className="pill opacity-50 cursor-not-allowed text-xs"
                        title="Backend revocation endpoint required"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 panel p-4">
                    <div>
                      <div className="text-sm font-medium">No active key</div>
                      <div className="text-xs muted mt-0.5">Issue a key to activate an Execution Engine with this license.</div>
                    </div>
                    <button
                      disabled
                      className="pill opacity-50 cursor-not-allowed text-xs shrink-0"
                      title="Backend key issuance endpoint required"
                    >
                      <KeyRound size={12} /> Issue key
                    </button>
                  </div>
                )}

                {/* Security notice */}
                <div className="panel p-4 border-[#f5b942]/20 bg-[#f5b942]/04">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#f5b942] mb-2">
                    Key security
                  </div>
                  <p className="muted text-xs leading-5">
                    Key issuance, rotation, and revocation require an authenticated Gateway endpoint.
                    Raw keys are displayed once immediately after issuance and not stored in plain text.
                    The browser never generates or hashes activation keys.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
