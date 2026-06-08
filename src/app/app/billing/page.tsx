"use client";

import { getBrowserSupabase } from "@/lib/supabase-singleton";
import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/metric-detail";
import {
  CreditCard, ExternalLink,
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
  trialDays:   number | null;
};

/* ── helpers ──────────────────────────────────────────────────────────── */
function gatewayHttpBase(): string {
  const wsUrl = process.env.NEXT_PUBLIC_GATEWAY_WS_URL ?? "wss://apex-gateway.somicast.com/dashboard";
  const http  = wsUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
  try { return new URL(http).origin; } catch { return "https://apex-gateway.somicast.com"; }
}


/* ── What-you-get illustrations ───────────────────────────────────────── */
function EngineIllustration() {
  return (
    <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
      {/* chip body */}
      <rect x="32" y="14" width="56" height="52" rx="7" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.1)" strokeWidth="1"/>
      {/* inner die */}
      <rect x="42" y="23" width="36" height="34" rx="4" fill="rgba(255,255,255,.03)" stroke="rgba(255,255,255,.07)" strokeWidth="1"/>
      {/* left pins */}
      <rect x="20" y="25" width="12" height="3.5" rx="1.75" fill="rgba(255,255,255,.1)"/>
      <rect x="20" y="34" width="12" height="3.5" rx="1.75" fill="rgba(255,255,255,.1)"/>
      <rect x="20" y="43" width="12" height="3.5" rx="1.75" fill="rgba(255,255,255,.07)"/>
      <rect x="20" y="52" width="12" height="3.5" rx="1.75" fill="rgba(255,255,255,.07)"/>
      {/* right pins */}
      <rect x="88" y="25" width="12" height="3.5" rx="1.75" fill="rgba(255,255,255,.1)"/>
      <rect x="88" y="34" width="12" height="3.5" rx="1.75" fill="rgba(255,255,255,.1)"/>
      <rect x="88" y="43" width="12" height="3.5" rx="1.75" fill="rgba(255,255,255,.07)"/>
      <rect x="88" y="52" width="12" height="3.5" rx="1.75" fill="rgba(255,255,255,.07)"/>
      {/* execution waveform inside die */}
      <polyline points="44,40 48,40 51,30 54,50 57,30 60,50 63,40 68,40 70,36 74,36"
        stroke="#3ddc97" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity=".85"/>
      {/* center glow */}
      <ellipse cx="60" cy="40" rx="18" ry="11" fill="#3ddc97" fillOpacity=".05"/>
      {/* status dot */}
      <circle cx="60" cy="63" r="2.5" fill="#3ddc97" opacity=".8"/>
      <circle cx="60" cy="63" r="5.5" fill="#3ddc97" fillOpacity=".08"/>
    </svg>
  );
}

function SignalIllustration() {
  return (
    <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
      {/* source node */}
      <circle cx="20" cy="40" r="9" fill="rgba(61,220,151,.1)" stroke="rgba(61,220,151,.28)" strokeWidth="1.2"/>
      <circle cx="20" cy="40" r="4" fill="#3ddc97" opacity=".85"/>
      <circle cx="20" cy="40" r="14" fill="#3ddc97" fillOpacity=".04"/>
      {/* broadcast arcs */}
      <path d="M33 24 Q46 40 33 56" stroke="#3ddc97" strokeWidth="1.4" fill="none" opacity=".5" strokeLinecap="round"/>
      <path d="M40 17 Q58 40 40 63" stroke="#3ddc97" strokeWidth="1.1" fill="none" opacity=".28" strokeLinecap="round"/>
      <path d="M47 11 Q70 40 47 69" stroke="#3ddc97" strokeWidth=".8" fill="none" opacity=".13" strokeLinecap="round"/>
      {/* transmission path */}
      <line x1="60" y1="40" x2="86" y2="40" stroke="rgba(255,255,255,.1)" strokeWidth="1.2" strokeDasharray="3,3"/>
      {/* in-flight packet */}
      <circle cx="74" cy="40" r="3" fill="#3ddc97" opacity=".55"/>
      <circle cx="74" cy="40" r="6" fill="#3ddc97" fillOpacity=".08"/>
      {/* receiver device */}
      <rect x="88" y="24" width="26" height="32" rx="5" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.12)" strokeWidth="1"/>
      <rect x="94" y="31" width="14" height="2.5" rx="1.25" fill="rgba(255,255,255,.2)"/>
      <rect x="94" y="37" width="9" height="2.5" rx="1.25" fill="rgba(255,255,255,.13)"/>
      <circle cx="101" cy="49" r="2.5" fill="#3ddc97" opacity=".75"/>
      <circle cx="101" cy="49" r="5" fill="#3ddc97" fillOpacity=".1"/>
    </svg>
  );
}

function KeyIllustration() {
  return (
    <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
      {/* key ring */}
      <circle cx="22" cy="40" r="13" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="2"/>
      <circle cx="22" cy="40" r="5.5" fill="rgba(61,220,151,.2)" stroke="rgba(61,220,151,.45)" strokeWidth="1.2"/>
      {/* key shaft */}
      <rect x="33" y="37.5" width="38" height="5" rx="2.5" fill="rgba(255,255,255,.14)"/>
      {/* teeth */}
      <rect x="42" y="42.5" width="4.5" height="7" rx="1.5" fill="rgba(255,255,255,.14)"/>
      <rect x="52" y="42.5" width="4.5" height="5" rx="1.5" fill="rgba(255,255,255,.14)"/>
      <rect x="62" y="42.5" width="4.5" height="9" rx="1.5" fill="rgba(255,255,255,.14)"/>
      {/* connect trace */}
      <path d="M71 40 L80 40" stroke="#3ddc97" strokeWidth="1.3" opacity=".6" strokeDasharray="2,2"/>
      {/* lock body */}
      <rect x="80" y="26" width="34" height="28" rx="6" fill="rgba(61,220,151,.07)" stroke="rgba(61,220,151,.22)" strokeWidth="1.2"/>
      {/* shackle */}
      <path d="M89 26 L89 19 Q97 12 105 19 L105 26" stroke="rgba(255,255,255,.18)" strokeWidth="2" fill="none" strokeLinecap="round"/>
      {/* keyhole */}
      <circle cx="97" cy="36" r="5" fill="rgba(61,220,151,.14)" stroke="#3ddc97" strokeWidth="1" opacity=".6"/>
      <rect x="95.5" y="36" width="3" height="6" rx="1.5" fill="#3ddc97" opacity=".45"/>
      {/* glow */}
      <ellipse cx="97" cy="38" rx="16" ry="10" fill="#3ddc97" fillOpacity=".05"/>
    </svg>
  );
}

const WHAT_YOU_GET = [
  {
    Illustration: EngineIllustration,
    title: "Execution Engine",
    desc:  "Install and run on any device or VPS. Connects to the gateway and executes trade signals automatically.",
  },
  {
    Illustration: SignalIllustration,
    title: "Signal Delivery",
    desc:  "Private trade signals delivered directly to your engine the moment they are released.",
  },
  {
    Illustration: KeyIllustration,
    title: "Activation Keys",
    desc:  "One key per device license. Use them to authenticate and register each engine instance.",
  },
];

/* ── Plan illustrations ───────────────────────────────────────────────── */
function StarterIllustration() {
  return (
    <svg viewBox="0 0 200 88" fill="none" className="w-full h-auto">
      {/* single chip */}
      <rect x="60" y="20" width="52" height="48" rx="6" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.09)" strokeWidth="1"/>
      <rect x="70" y="29" width="32" height="30" rx="3" fill="rgba(255,255,255,.03)" stroke="rgba(255,255,255,.06)" strokeWidth="1"/>
      {/* pins left */}
      <rect x="47" y="28" width="13" height="3" rx="1.5" fill="rgba(255,255,255,.09)"/>
      <rect x="47" y="37" width="13" height="3" rx="1.5" fill="rgba(255,255,255,.09)"/>
      <rect x="47" y="46" width="13" height="3" rx="1.5" fill="rgba(255,255,255,.07)"/>
      <rect x="47" y="55" width="13" height="3" rx="1.5" fill="rgba(255,255,255,.06)"/>
      {/* pins right */}
      <rect x="112" y="28" width="13" height="3" rx="1.5" fill="rgba(255,255,255,.09)"/>
      <rect x="112" y="37" width="13" height="3" rx="1.5" fill="rgba(255,255,255,.09)"/>
      <rect x="112" y="46" width="13" height="3" rx="1.5" fill="rgba(255,255,255,.07)"/>
      <rect x="112" y="55" width="13" height="3" rx="1.5" fill="rgba(255,255,255,.06)"/>
      {/* waveform */}
      <polyline points="72,44 76,44 79,34 82,54 85,34 88,54 91,44 98,44" stroke="#3ddc97" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity=".82"/>
      {/* glow */}
      <ellipse cx="86" cy="44" rx="17" ry="11" fill="#3ddc97" fillOpacity=".05"/>
      {/* connection to gateway */}
      <line x1="125" y1="44" x2="152" y2="44" stroke="rgba(255,255,255,.09)" strokeWidth="1" strokeDasharray="3,3"/>
      {/* gateway */}
      <circle cx="162" cy="44" r="12" fill="rgba(61,220,151,.09)" stroke="rgba(61,220,151,.24)" strokeWidth="1.2"/>
      <circle cx="162" cy="44" r="5" fill="#3ddc97" opacity=".75"/>
      <circle cx="162" cy="44" r="19" fill="#3ddc97" fillOpacity=".04"/>
    </svg>
  );
}

function ProIllustration() {
  return (
    <svg viewBox="0 0 200 88" fill="none" className="w-full h-auto">
      {/* 3 chips stacked left */}
      <rect x="8" y="8"  width="58" height="20" rx="4" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.09)" strokeWidth="1"/>
      <polyline points="13,18 17,18 19,13 22,23 25,13 28,23 31,18 58,18" stroke="#3ddc97" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" opacity=".65"/>

      <rect x="8" y="34" width="58" height="20" rx="4" fill="rgba(255,255,255,.05)" stroke="rgba(61,220,151,.16)" strokeWidth="1"/>
      <polyline points="13,44 17,44 19,39 22,49 25,39 28,49 31,44 58,44" stroke="#3ddc97" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity=".85"/>

      <rect x="8" y="60" width="58" height="20" rx="4" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.09)" strokeWidth="1"/>
      <polyline points="13,70 17,70 19,65 22,75 25,65 28,75 31,70 58,70" stroke="#3ddc97" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" opacity=".65"/>

      {/* fan lines to hub */}
      <line x1="66" y1="18" x2="112" y2="44" stroke="rgba(255,255,255,.08)" strokeWidth="1" strokeDasharray="3,2"/>
      <line x1="66" y1="44" x2="112" y2="44" stroke="rgba(255,255,255,.1)"  strokeWidth="1" strokeDasharray="3,2"/>
      <line x1="66" y1="70" x2="112" y2="44" stroke="rgba(255,255,255,.08)" strokeWidth="1" strokeDasharray="3,2"/>

      {/* hub */}
      <circle cx="118" cy="44" r="14" fill="rgba(61,220,151,.08)" stroke="rgba(61,220,151,.22)" strokeWidth="1.2"/>
      <circle cx="118" cy="44" r="5.5" fill="#3ddc97" opacity=".72"/>
      <ellipse cx="118" cy="44" rx="22" ry="18" fill="#3ddc97" fillOpacity=".04"/>

      {/* gateway */}
      <line x1="132" y1="44" x2="155" y2="44" stroke="rgba(255,255,255,.08)" strokeWidth="1" strokeDasharray="3,3"/>
      <circle cx="164" cy="44" r="11" fill="rgba(61,220,151,.09)" stroke="rgba(61,220,151,.22)" strokeWidth="1.1"/>
      <circle cx="164" cy="44" r="4.5" fill="#3ddc97" opacity=".72"/>
    </svg>
  );
}

function InfraIllustration() {
  return (
    <svg viewBox="0 0 200 88" fill="none" className="w-full h-auto">
      {/* 6 chips — 2 cols × 3 rows */}
      {[0,1,2].map((row) => [0,1].map((col) => (
        <g key={`${row}-${col}`}>
          <rect x={4 + col * 44} y={6 + row * 27} width="38" height="18" rx="3"
            fill={row === 1 && col === 0 ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.03)"}
            stroke={row === 1 && col === 0 ? "rgba(61,220,151,.15)" : "rgba(255,255,255,.08)"}
            strokeWidth="1"/>
          <polyline
            points={`${7 + col * 44},${15 + row * 27} ${10 + col * 44},${15 + row * 27} ${12 + col * 44},${11 + row * 27} ${14 + col * 44},${19 + row * 27} ${16 + col * 44},${11 + row * 27} ${18 + col * 44},${19 + row * 27} ${20 + col * 44},${15 + row * 27} ${38 + col * 44},${15 + row * 27}`}
            stroke="#3ddc97" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"
            opacity={row === 1 && col === 0 ? .78 : .5}/>
        </g>
      )))}

      {/* fan lines → hub */}
      {[0,1,2].map((row) => [0,1].map((col) => (
        <line key={`l-${row}-${col}`}
          x1={42 + col * 44} y1={15 + row * 27}
          x2="120" y2="44"
          stroke="rgba(255,255,255,.07)" strokeWidth="1" strokeDasharray="2,3"/>
      )))}

      {/* hub */}
      <circle cx="126" cy="44" r="16" fill="rgba(61,220,151,.08)" stroke="rgba(61,220,151,.22)" strokeWidth="1.3"/>
      <circle cx="126" cy="44" r="6.5" fill="#3ddc97" opacity=".72"/>
      <ellipse cx="126" cy="44" rx="25" ry="20" fill="#3ddc97" fillOpacity=".04"/>

      {/* gateway */}
      <line x1="142" y1="44" x2="163" y2="44" stroke="rgba(255,255,255,.09)" strokeWidth="1" strokeDasharray="3,2"/>
      <circle cx="172" cy="44" r="11" fill="rgba(61,220,151,.09)" stroke="rgba(61,220,151,.22)" strokeWidth="1.1"/>
      <circle cx="172" cy="44" r="4.5" fill="#3ddc97" opacity=".72"/>
    </svg>
  );
}

const PLAN_ILLUSTRATION: Record<string, React.ComponentType> = {
  starter:        StarterIllustration,
  pro:            ProIllustration,
  infrastructure: InfraIllustration,
};

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
              ? { background: "var(--success-bg)", color: "var(--success)", border: "1px solid var(--success-border)" }
              : { background: "transparent", color: "var(--muted)", border: "1px solid transparent" }
          }
        >
          {iv === "monthly" ? "Monthly" : "Yearly"}
          {iv === "yearly" && (
            <span className="ml-1.5 text-[10px]" style={{ color: "var(--success)" }}>−20%</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ── helpers ──────────────────────────────────────────────────────────── */
function buildCheckoutUrl(
  base: string,
  email?: string | null,
  userId?: string | null,
): string {
  try {
    const url = new URL(base);
    if (email)  url.searchParams.set("checkout[email]", email);
    if (userId) url.searchParams.set("checkout[custom][supabase_user_id]", userId);
    return url.toString();
  } catch {
    return base;
  }
}

/* ── PlanCardSkeleton ─────────────────────────────────────────────────── */
function PlanCardSkeleton({ highlight }: { highlight?: boolean }) {
  return (
    <div
      className="panel flex flex-col overflow-hidden"
      style={highlight ? { borderColor: "var(--success-border)" } : undefined}
    >
      {/* accent strip placeholder */}
      {highlight && (
        <div className="h-[33px]" style={{ background: "var(--success-bg)", borderBottom: "1px solid var(--success-border)" }} />
      )}

      {/* illustration placeholder */}
      <div className="px-4 pt-4 pb-1">
        <div className="skeleton rounded-md" style={{ height: 88 }} />
      </div>

      {/* header */}
      <div className="px-5 pt-2 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <div className="skeleton h-3.5 w-24 mb-2" />
        <div className="skeleton h-2.5 w-40" />
      </div>

      {/* price */}
      <div className="px-5 py-5 flex flex-col gap-5">
        <div style={{ borderBottom: "1px solid rgba(255,255,255,.06)", paddingBottom: "1.25rem" }}>
          <div className="skeleton h-7 w-28 mb-2" />
          <div className="skeleton h-2 w-36 mb-3" />
          <div className="skeleton h-[26px] w-32 rounded-md" />
        </div>

        {/* CTA */}
        <div className="skeleton rounded h-9 w-full" />
      </div>
    </div>
  );
}

/* ── PlanCard ─────────────────────────────────────────────────────────── */
function PlanCard({
  plan,
  userEmail,
  userId,
}: {
  plan: BillingPlan;
  userEmail?: string | null;
  userId?: string | null;
}) {
  const Illustration = PLAN_ILLUSTRATION[plan.planKey] ?? StarterIllustration;

  return (
    <div
      className="panel flex flex-col overflow-hidden"
      style={plan.highlight ? { borderColor: "var(--success-border)" } : undefined}
    >
      {/* Most popular accent strip */}
      {plan.highlight && (
        <div className="flex items-center gap-2 px-5 py-2"
             style={{ background: "var(--success-bg)", borderBottom: "1px solid var(--success-border)" }}>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--success)", boxShadow: "0 0 6px var(--success)" }} />
          <span className="text-[10px] font-bold uppercase tracking-[.12em]" style={{ color: "var(--success)" }}>Most popular</span>
        </div>
      )}

      {/* Illustration */}
      <div className="px-4 pt-4 pb-1">
        <Illustration />
      </div>

      {/* Header */}
      <div className="px-5 pt-2 pb-4 flex items-start justify-between gap-3"
           style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <div>
          <div className="text-sm font-semibold">{plan.name}</div>
          <div className="text-[11px] muted leading-snug mt-0.5">{plan.desc}</div>
        </div>
      </div>

      <div className="px-5 py-5 flex flex-col">

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
            {plan.interval === "yearly" && (
              plan.trialDays ? (
                <div className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-md"
                     style={{ background: "var(--success-bg)", border: "1px solid var(--success-border)" }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--success)" }} />
                  <span className="text-[11px] font-semibold" style={{ color: "var(--success)" }}>
                    {plan.trialDays}-day free trial
                  </span>
                </div>
              ) : (
                <div className="mt-3 h-[26px]" /> // placeholder to keep height consistent
              )
            )}
          </>
        )}
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
          <button
            onClick={() => {
              const url = buildCheckoutUrl(plan.checkoutUrl, userEmail, userId);
              if (url) window.open(url, "_blank", "noopener,noreferrer");
            }}
            disabled={!plan.checkoutUrl}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded text-xs font-semibold transition-opacity hover:opacity-80 w-full"
            style={
              plan.checkoutUrl
                ? plan.highlight
                  ? { background: "var(--success-bg)", color: "var(--success)", border: "1px solid var(--success-border)" }
                  : { background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.75)", border: "1px solid rgba(255,255,255,.11)" }
                : { background: "rgba(255,255,255,.03)", color: "rgba(255,255,255,.25)", border: "1px solid rgba(255,255,255,.06)", cursor: "not-allowed" }
            }
          >
            {plan.checkoutUrl ? <><span>Subscribe</span> <ExternalLink size={11} /></> : "Coming soon"}
          </button>
        )}
      </div>
      </div>{/* end px-5 body */}
    </div>
  );
}

/* ── page ─────────────────────────────────────────────────────────────── */
export default function Billing() {
  const { session } = useAuth();
  const userEmail   = session?.user.email ?? null;
  const userId      = session?.user.id    ?? null;

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
          {WHAT_YOU_GET.map(({ Illustration, title, desc }) => (
            <div key={title} className="panel flex flex-col overflow-hidden">
              <div className="px-4 pt-4 pb-1">
                <Illustration />
              </div>
              <div className="px-5 pb-5 pt-2">
                <div className="text-sm font-semibold mb-1.5">{title}</div>
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
          {plansLoading && (
            <div className="skeleton h-8 w-40 rounded-md" />
          )}
          {!plansLoading && plans.length > 0 && (
            <IntervalToggle value={interval} onChange={setInterval} />
          )}
        </div>

        {plansLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
            <PlanCardSkeleton />
            <PlanCardSkeleton highlight />
            <PlanCardSkeleton />
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
              <PlanCard key={plan.variantId} plan={plan} userEmail={userEmail} userId={userId} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
