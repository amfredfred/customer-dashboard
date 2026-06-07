"use client";

import { createBrowserSupabase } from "@/lib/supabase";
import { CheckCircle, CreditCard, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

/* ── types ────────────────────────────────────────────────────────────── */
type PlanRow = {
  id: string;
  status: string;
  max_devices: number;
  expires_at: string | null;
  issued_at?: string | null;
  plan_name?: string;
  plan_id?: string;
  billing_interval?: string;
  billing_amount?: number;
  billing_currency?: string;
  next_billing_at?: string | null;
  payment_provider?: string;
};

/* ── data ─────────────────────────────────────────────────────────────── */
const PLAN_TIERS = [
  {
    id: "starter",
    name: "Starter",
    price: "$49",
    interval: "/mo",
    desc: "For testing and a single execution engine.",
    features: [
      "1 Execution Engine",
      "Private signal access",
      "Core risk controls",
      "Customer dashboard",
    ],
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$129",
    interval: "/mo",
    desc: "For active traders running live execution.",
    features: [
      "Up to 3 Execution Engines",
      "Multi-account monitoring",
      "Per-account risk settings",
      "Priority diagnostics",
    ],
    highlight: true,
  },
  {
    id: "infrastructure",
    name: "Infrastructure",
    price: "Custom",
    interval: "",
    desc: "For advanced users or teams needing scale.",
    features: [
      "Unlimited Execution Engines",
      "Prop firm drawdown rules",
      "Rule templates",
      "Dedicated support",
    ],
    highlight: false,
  },
] as const;

/* ── helpers ──────────────────────────────────────────────────────────── */
function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
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

/* ── page ─────────────────────────────────────────────────────────────── */
export default function Billing() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const { data, error: err } = await supabase
      .from("licenses")
      .select(
        "id,status,max_devices,expires_at,issued_at,plan_name,plan_id,billing_interval,billing_amount,billing_currency,next_billing_at,payment_provider"
      )
      .eq("status", "active")
      .limit(1);
    if (err) { setError(err.message); setLoading(false); return; }
    setPlan(((data ?? []) as PlanRow[])[0] ?? null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  const planLabel = plan
    ? String((plan as Record<string,unknown>).plan_name ?? (plan as Record<string,unknown>).plan_id ?? "Active plan")
    : null;

  const priceDisplay = plan
    ? plan.billing_amount !== undefined
      ? `${plan.billing_currency ?? "$"}${plan.billing_amount}`
      : planLabel
    : null;

  return (
    <div className="p-5 md:p-8 max-w-6xl mx-auto page-in space-y-2">
      {/* Header */}
      <div className="text-[10px] uppercase tracking-[.17em] muted">Subscription</div>
      <h1 className="text-3xl font-semibold tracking-tight">Billing</h1>
      <p className="muted text-sm leading-5">
        Current plan, billing state, and available pricing tiers.
      </p>

      {/* Current plan */}
      <SectionRule label="Current plan" />

      {loading && (
        <div className="panel p-5">
          <div className="skeleton h-3 w-24 mb-4" />
          <div className="skeleton h-7 w-40 mb-3" />
          <div className="skeleton h-2.5 w-32" />
        </div>
      )}

      {!loading && error && (
        <div className="panel p-4 border-[#f43f5e]/30 bg-[#f43f5e]/05 text-sm text-[#f43f5e]">
          {error}
        </div>
      )}

      {!loading && !error && supabase && !plan && (
        <div className="panel p-5 state-block">
          <CreditCard size={28} className="text-white/10 mb-2" />
          <div className="font-medium">No active plan</div>
          <p className="muted text-xs max-w-xs">
            Choose a plan below to purchase a license and receive access to the TradeRelay execution network.
          </p>
        </div>
      )}

      {!loading && !supabase && (
        <div className="panel p-5 border-[#f5b942]/30">
          <div className="text-xs font-bold uppercase tracking-wider text-[#f5b942]">Supabase required</div>
          <p className="muted text-xs mt-2 leading-5">Configure the public Supabase environment variables to load billing state.</p>
        </div>
      )}

      {!loading && plan && (
        <div className="panel overflow-hidden">
          <div className="p-5 border-b border-white/[.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#3ddc97]/10 border border-[#3ddc97]/25 grid place-items-center shrink-0">
                <ShieldCheck size={16} className="text-[#3ddc97]" />
              </div>
              <div>
                <div className="font-semibold">{planLabel ?? "Active plan"}</div>
                <div className="text-xs muted mt-0.5">
                  {plan.billing_interval
                    ? `Billed ${plan.billing_interval}`
                    : "Billing interval not recorded"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-3xl font-semibold tracking-tight">
                {priceDisplay}
                {plan.billing_interval && plan.billing_amount !== undefined && (
                  <span className="text-sm muted">/{plan.billing_interval}</span>
                )}
              </div>
              <span className="badge badge-green">{plan.status}</span>
            </div>
          </div>

          <div className="p-5 grid sm:grid-cols-3 gap-5 text-sm">
            <div>
              <div className="muted text-xs">Max devices</div>
              <div className="mt-2 mono font-medium">{plan.max_devices}</div>
            </div>
            <div>
              <div className="muted text-xs">Next billing</div>
              <div className="mt-2 mono font-medium">{fmtDate(plan.next_billing_at)}</div>
            </div>
            <div>
              <div className="muted text-xs">Payment provider</div>
              <div className="mt-2 mono font-medium">
                {plan.payment_provider ?? "Not recorded"}
              </div>
            </div>
          </div>

          <div className="px-5 pb-5">
            <div className="panel p-4 border-[#f5b942]/20 bg-[#f5b942]/04">
              <p className="text-xs muted leading-5">
                Subscription changes require a verified payment-provider webhook.
                Plan upgrades, downgrades, and cancellations are not available directly from the dashboard yet.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pricing tiers */}
      <SectionRule label="Available plans" />
      <div className="grid md:grid-cols-3 gap-4">
        {PLAN_TIERS.map(tier => {
          const isCurrent = planLabel?.toLowerCase() === tier.name.toLowerCase()
            || planLabel?.toLowerCase() === tier.id;
          return (
            <div
              key={tier.id}
              className="panel p-6 flex flex-col"
              style={
                tier.highlight
                  ? { borderColor: "rgba(61,220,151,.25)", background: "rgba(61,220,151,.04)" }
                  : undefined
              }
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-sm font-semibold">{tier.name}</span>
                {isCurrent && <span className="badge badge-green">Current</span>}
                {tier.highlight && !isCurrent && <span className="badge badge-muted">Popular</span>}
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
                className={`mt-8 py-3 text-center rounded-xl text-sm font-medium border border-white/10 text-white/40 cursor-not-allowed select-none`}
                title="Checkout integration required"
              >
                {isCurrent ? "Current plan" : "Checkout required"}
              </div>
            </div>
          );
        })}
      </div>
      <p className="muted text-xs">
        Checkout and subscription management require a verified payment-provider webhook before a license is issued.
        No trial is activated automatically.
      </p>
    </div>
  );
}
