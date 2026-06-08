"use client";

import { getBrowserSupabase } from "@/lib/supabase-singleton";
import { PageHeader } from "@/components/metric-detail";
import {
  CreditCard, Loader2, Zap, Rocket, Building2,
  ExternalLink, Download, Radio, KeyRound,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

/* ── types ────────────────────────────────────────────────────────────── */
type BillingPlan = {
  variantId:   string;
  planKey:     string;
  interval:    "monthly" | "yearly" | "custom";
  name:        string;
  price:       string;
  priceNote:   string;
  currency:    string;
  devices:     number;
  desc:        string;
  features:    string[];
  highlight:   boolean;
  checkoutUrl: string;
};

/* ── helpers ──────────────────────────────────────────────────────────── */
function gatewayHttpBase(): string {
  const wsUrl = process.env.NEXT_PUBLIC_GATEWAY_WS_URL ?? "wss://apex-gateway.somicast.com/dashboard";
  const http  = wsUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
  try { return new URL(http).origin; } catch { return "https://apex-gateway.somicast.com"; }
}

const PLAN_ICON: Record<string, React.ElementType> = {
  starter:        Zap,
  pro:            Rocket,
  infrastructure: Building2,
};

const WHAT_YOU_GET = [
  {
    icon:  Download,
    title: "Execution Engine",
    desc:  "Install and run on any device or VPS. Connects to the gateway and executes trade signals automatically.",
  },
  {
    icon:  Radio,
    title: "Signal Delivery",
    desc:  "Private trade signals delivered directly to your engine the moment they are released.",
  },
  {
    icon:  KeyRound,
    title: "Activation Keys",
    desc:  "One key per device license. Use them to authenticate and register each engine instance.",
  },
];

/* ── IntervalToggle ───────────────────────────────────────────────────── */
function IntervalToggle({
  value,
  onChange,
}: {
  value: "monthly" | "yearly";
  onChange: (v: "monthly" | "yearly") => void;
}) {
  return (
    <div
      className="inline-flex p-0.5 rounded-md gap-0.5"
      style={{ background: "var(--surface-raised)", border: "1px solid var(--line)" }}
    >
      {(["monthly", "yearly"] as const).map((iv) => (
        <button
          key={iv}
          onClick={() => onChange(iv)}
          className="px-4 py-1.5 rounded text-xs font-semibold transition-all"
          style={
            value === iv
              ? { background: "rgba(61,220,151,.15)", color: "#3ddc97", border: "1px solid rgba(61,220,151,.25)" }
              : { background: "transparent", color: "var(--muted)", border: "1px solid transparent" }
          }
        >
          {iv === "monthly" ? "Monthly" : "Yearly"}
          {iv === "yearly" && (
            <span className="ml-1.5 text-[10px]" style={{ color: "#3ddc97" }}>−20%</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ── PlanCard ─────────────────────────────────────────────────────────── */
function PlanCard({ plan }: { plan: BillingPlan }) {
  const Icon = PLAN_ICON[plan.planKey] ?? Zap;

  return (
    <div
      className="panel p-6 flex flex-col"
      style={plan.highlight ? { borderColor: "rgba(61,220,151,.3)" } : undefined}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-md grid place-items-center shrink-0"
            style={{ background: "rgba(61,220,151,.08)", border: "1px solid rgba(61,220,151,.18)" }}
          >
            <Icon size={15} style={{ color: "#3ddc97" }} />
          </div>
          <div>
            <div className="text-sm font-semibold">{plan.name}</div>
            <div className="text-[11px] muted leading-snug mt-0.5">{plan.desc}</div>
          </div>
        </div>
        {plan.highlight && (
          <span className="badge badge-muted text-[10px] shrink-0">Popular</span>
        )}
      </div>

      {/* Price */}
      <div
        className="mb-5 pb-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}
      >
        {plan.interval === "custom" ? (
          <div className="text-2xl font-bold tracking-tight">Custom</div>
        ) : (
          <>
            <div className="text-2xl font-bold tracking-tight">
              {plan.price}
              <span className="text-sm font-normal muted ml-1">/mo</span>
            </div>
            {plan.priceNote && plan.interval === "yearly" && (
              <div className="text-[11px] muted mt-1">{plan.priceNote}</div>
            )}
          </>
        )}
      </div>

      {/* Device license count */}
      <div className="flex-1 flex flex-col items-center justify-center py-6 gap-2">
        <div className="font-bold tracking-tight" style={{ fontSize: "3.5rem", lineHeight: 1, color: "var(--text)" }}>
          {plan.devices >= 9999 ? "∞" : plan.devices}
        </div>
        <div className="text-base font-semibold muted">
          {plan.devices === 1 ? "device license" : "device licenses"}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-6">
        {plan.interval === "custom" ? (
          <a
            href="mailto:support@apexquanttrader.io"
            className="block py-2.5 text-center rounded text-xs font-semibold transition-opacity hover:opacity-80"
            style={{
              background: "rgba(255,255,255,.05)",
              color: "rgba(255,255,255,.55)",
              border: "1px solid rgba(255,255,255,.09)",
            }}
          >
            Contact us
          </a>
        ) : (
          <a
            href={plan.checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 py-2.5 rounded text-xs font-semibold transition-opacity hover:opacity-80"
            style={
              plan.highlight
                ? { background: "rgba(61,220,151,.14)", color: "#3ddc97", border: "1px solid rgba(61,220,151,.28)" }
                : { background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.75)", border: "1px solid rgba(255,255,255,.11)" }
            }
          >
            Subscribe <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );
}

/* ── page ─────────────────────────────────────────────────────────────── */
export default function Billing() {
  const [plans, setPlans]               = useState<BillingPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [interval, setInterval]         = useState<"monthly" | "yearly">("yearly");

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const res  = await fetch(`${gatewayHttpBase()}/billing/plans`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { plans: BillingPlan[] };
      setPlans(json.plans ?? []);
    } catch {
      setPlans([]);
    } finally {
      setPlansLoading(false);
    }
  }, []);

  useEffect(() => { void loadPlans(); }, [loadPlans]);

  // suppress unused import warning — supabase still needed by the module
  void getBrowserSupabase;

  const visiblePlans  = plans.filter((p) => p.interval === interval || p.interval === "custom");
  const storeCurrency = plans[0]?.currency ?? null;

  return (
    <div className="page-wrap space-y-8">
      <PageHeader
        eyebrow="Subscription"
        title="Billing"
        description="Everything included in every plan. Only the device count changes."
      />

      {/* ── What you get ───────────────────────────────────────────────── */}
      <section>
        <div className="text-[10px] font-bold uppercase tracking-[.1em] muted mb-3">
          What&rsquo;s included
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {WHAT_YOU_GET.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="panel p-4 flex gap-3">
              <div
                className="w-8 h-8 rounded shrink-0 grid place-items-center mt-0.5"
                style={{ background: "rgba(61,220,151,.08)", border: "1px solid rgba(61,220,151,.15)" }}
              >
                <Icon size={13} style={{ color: "#3ddc97" }} />
              </div>
              <div>
                <div className="text-xs font-semibold mb-1">{title}</div>
                <div className="text-[11px] muted leading-relaxed">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Plans ─────────────────────────────────────────────────────── */}
      <section>
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="text-[10px] font-bold uppercase tracking-[.1em] muted">
            Plans{storeCurrency ? ` · ${storeCurrency}` : ""}
          </div>
          {!plansLoading && plans.length > 0 && (
            <IntervalToggle value={interval} onChange={setInterval} />
          )}
        </div>

        {plansLoading && (
          <div className="flex items-center justify-center gap-2 py-12 muted text-xs">
            <Loader2 size={13} className="animate-spin" />
            Loading plans…
          </div>
        )}

        {!plansLoading && plans.length === 0 && (
          <div className="panel p-4 flex items-center gap-3">
            <CreditCard size={16} className="muted shrink-0" />
            <div>
              <div className="text-sm font-medium">Plans coming soon</div>
              <p className="muted text-xs mt-0.5">Pricing will be available here shortly. Contact support if you need access now.</p>
            </div>
          </div>
        )}

        {!plansLoading && visiblePlans.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
            {visiblePlans.map((plan) => (
              <PlanCard key={plan.variantId} plan={plan} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
