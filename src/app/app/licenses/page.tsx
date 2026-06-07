"use client";

import { getBrowserSupabase } from "@/lib/supabase-singleton";
import { PageHeader, SectionHead } from "@/components/metric-detail";
import { AlertCircle, KeyRound, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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

/* ── page ────────────────────────────────────────────────────────────── */
export default function Licenses() {
  const supabase = getBrowserSupabase();
  const [licenses, setLicenses] = useState<LicenseView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      {/* Error */}
      {error && !loading && (
        <div className="panel p-4 mt-2" style={{ borderColor: "rgba(244,63,94,.3)", background: "rgba(244,63,94,.05)" }}>
          <div className="flex items-center gap-2 text-[#f43f5e] text-sm font-semibold">
            <AlertCircle size={14} /> {error}
          </div>
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
        const isActive = lic.status === "active";
        const statusBadge = isActive ? "badge-green" : lic.status === "expired" ? "badge-warn" : "badge-red";

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
                    <div className="text-sm font-medium">Key hash on file</div>
                    <div className="text-xs muted mt-0.5">
                      The raw key was shown once at issuance. Rotate via the Gateway API to issue a new one.
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button disabled className="pill opacity-40 cursor-not-allowed text-xs" title="Gateway endpoint required">
                      <KeyRound size={12} /> Rotate
                    </button>
                    <button disabled className="pill opacity-40 cursor-not-allowed text-xs" title="Gateway endpoint required">
                      Revoke
                    </button>
                  </div>
                </div>
                <div className="panel p-4" style={{ borderColor: "rgba(245,185,66,.2)", background: "rgba(245,185,66,.04)" }}>
                  <div className="text-xs font-bold uppercase tracking-wider text-[#f5b942] mb-2">Key security</div>
                  <p className="muted text-xs leading-5">
                    Key issuance and rotation require a backend Gateway endpoint.
                    Raw keys are shown once at issuance and never stored in plain text.
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
