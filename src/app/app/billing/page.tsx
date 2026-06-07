"use client";

import { getBrowserSupabase } from "@/lib/supabase-singleton";
import { PageHeader, SectionHead } from "@/components/metric-detail";
import { CheckCircle, CreditCard, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

/* ── types ────────────────────────────────────────────────────────────── */
// Real licenses columns: id, status, max_devices, expires_at, created_at, updated_at
type LicenseRow = {
  id: string;
  status: string;
  max_devices: number;
  expires_at: string | null;
};

/* ── plan tiers (static, no backend pricing API yet) ──────────────────── */
const PLAN_TIERS = [
  {
    id: "starter",
    name: "Starter",
    price: "$49",
    interval: "/mo",
    desc: "For testing and a single execution engine.",
    features: ["1 Execution Engine", "Private signal access", "Core risk controls", "Customer dashboard"],
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$129",
    interval: "/mo",
    desc: "For active traders running live execution.",
    features: ["Up to 3 Execution Engines", "Multi-account monitoring", "Per-account risk settings", "Priority diagnostics"],
    highlight: true,
  },
  {
    id: "infrastructure",
    name: "Infrastructure",
    price: "Custom",
    interval: "",
    desc: "For advanced users or teams needing scale.",
    features: ["Unlimited Execution Engines", "Prop firm drawdown rules", "Rule templates", "Dedicated support"],
    highlight: false,
  },
] as const;

/* ── helpers ──────────────────────────────────────────────────────────── */
function fmtDate(v: string | null | undefined) {
  if (!v) return "No expiry";
  return new Date(v).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/* ── page ─────────────────────────────────────────────────────────────── */
export default function Billing() {
  const supabase = getBrowserSupabase();
  const [license, setLicense] = useState<LicenseRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const { data, error: err } = await supabase
      .from("licenses")
      .select("id,status,max_devices,expires_at")
      .eq("status", "active")
      .limit(1);
    if (err) { setError(err.message); setLoading(false); return; }
    setLicense(((data ?? []) as LicenseRow[])[0] ?? null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="page-wrap space-y-4">
      <PageHeader
        eyebrow="Subscription"
        title="Billing"
        description="Current license state and available pricing tiers."
      />

      <SectionHead label="Current license" />

      {loading && (
        <div className="panel overflow-hidden">
          <div className="panel-head">
            <div><div className="skeleton h-4 w-36 mb-2" /><div className="skeleton h-2.5 w-24" /></div>
            <div className="skeleton h-5 w-14 rounded" />
          </div>
          <div className="panel-body grid sm:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}><div className="skeleton h-2 w-20 mb-2" /><div className="skeleton h-4 w-24" /></div>
            ))}
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="panel p-4" style={{ borderColor: "rgba(244,63,94,.3)", background: "rgba(244,63,94,.05)" }}>
          <p className="text-sm text-[#f43f5e]">{error}</p>
        </div>
      )}

      {!loading && !error && supabase && !license && (
        <div className="panel state-block">
          <CreditCard size={28} className="text-white/10 mb-2" />
          <div className="font-medium">No active license</div>
          <p className="muted text-xs max-w-xs">
            Choose a plan below to purchase a license and gain access to the TradeRelay execution network.
          </p>
        </div>
      )}

      {!loading && !supabase && (
        <div className="panel p-5" style={{ borderColor: "rgba(245,185,66,.3)" }}>
          <div className="text-xs font-bold uppercase tracking-wider text-[#f5b942]">Supabase required</div>
          <p className="muted text-xs mt-2 leading-5">Configure the public Supabase environment variables to load billing state.</p>
        </div>
      )}

      {!loading && license && (
        <div className="panel overflow-hidden">
          <div className="panel-head flex-col sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#3ddc97]/10 border border-[#3ddc97]/25 grid place-items-center shrink-0">
                <ShieldCheck size={16} className="text-[#3ddc97]" />
              </div>
              <div>
                <div className="font-semibold">TradeRelay License</div>
                <div className="text-xs muted mt-0.5 mono">{license.id}</div>
              </div>
            </div>
            <span className="badge badge-green">{license.status}</span>
          </div>

          <div className="panel-body grid sm:grid-cols-3 gap-5 text-sm">
            <div>
              <div className="muted text-xs">Max devices</div>
              <div className="mt-2 mono font-medium">{license.max_devices}</div>
            </div>
            <div>
              <div className="muted text-xs">Expires</div>
              <div className="mt-2 mono font-medium">{fmtDate(license.expires_at)}</div>
            </div>
            <div>
              <div className="muted text-xs">Billing</div>
              <div className="mt-2 mono font-medium text-[var(--muted)]">
                Managed externally
              </div>
            </div>
          </div>

          <div className="px-5 pb-5">
            <div className="panel p-4" style={{ borderColor: "rgba(245,185,66,.2)", background: "rgba(245,185,66,.04)" }}>
              <p className="text-xs muted leading-5">
                Subscription changes require a verified payment-provider webhook.
                Plan upgrades, downgrades, and cancellations are not available directly from the dashboard yet.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pricing tiers */}
      <SectionHead label="Available plans" />
      <div className="grid md:grid-cols-3 gap-4">
        {PLAN_TIERS.map(tier => (
          <div
            key={tier.id}
            className="panel p-6 flex flex-col"
            style={tier.highlight ? { borderColor: "rgba(61,220,151,.25)", background: "rgba(61,220,151,.04)" } : undefined}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-sm font-semibold">{tier.name}</span>
              {tier.highlight && <span className="badge badge-muted">Popular</span>}
            </div>
            <p className="muted text-xs leading-5">{tier.desc}</p>
            <div className="mt-5 text-4xl font-semibold tracking-tight">
              {tier.price}
              <span className="text-base muted">{tier.interval}</span>
            </div>
            <div className="mt-6 space-y-3 flex-1">
              {tier.features.map(f => (
                <div key={f} className="flex items-start gap-2 text-sm muted">
                  <CheckCircle size={12} className="text-[#3ddc97] shrink-0 mt-0.5" />
                  {f}
                </div>
              ))}
            </div>
            <div
              className="mt-8 py-3 text-center rounded-lg text-sm font-medium border border-white/10 text-white/35 cursor-not-allowed select-none"
              title="Checkout integration required"
            >
              Checkout required
            </div>
          </div>
        ))}
      </div>
      <p className="muted text-xs">
        Checkout and subscription management require a verified payment-provider webhook before a license is issued.
        No trial is activated automatically.
      </p>
    </div>
  );
}
