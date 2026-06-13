"use client";

import { getBrowserSupabase } from "@/lib/supabase-singleton";
import { useAuth } from "@/components/auth-provider";
import { gatewayHttpBase } from "@/lib/gateway";
import {
  CreditCard, ExternalLink, CheckCircle2, ArrowRight,
  Bot, Radio, Zap, Users, LayoutDashboard, Key, Server, Shield, Headphones,
  type LucideIcon,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

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
      {/* 6 chips - 2 cols × 3 rows */}
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
      className="inline-flex p-1 rounded-full gap-1"
      style={{ background: "var(--surface-raised)", border: "1px solid var(--line)" }}
    >
      {(["monthly", "yearly"] as const).map((iv) => (
        <button
          key={iv}
          onClick={() => onChange(iv)}
          className="px-5 py-1.5 rounded-full text-xs font-semibold transition-all"
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
async function initializeCheckout(
  planCode: string,
  email: string,
): Promise<string> {
  const res = await fetch(`${gatewayHttpBase()}/billing/initialize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planCode, email }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { url: string };
  if (!json.url) throw new Error("No URL returned");
  return json.url;
}

/* ── PlanCardSkeleton ─────────────────────────────────────────────────── */
function PlanCardSkeleton({ highlight }: { highlight?: boolean }) {
  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        background: highlight
          ? "radial-gradient(ellipse 90% 50% at 50% 0%, rgba(61,220,151,.18) 0%, transparent 100%), rgba(255,255,255,.028)"
          : "rgba(255,255,255,.025)",
        border: `1px solid ${highlight ? "rgba(61,220,151,.3)" : "rgba(255,255,255,.09)"}`,
        borderRadius: 14,
      }}
    >
      {highlight && (
        <div style={{ height: 33, background: "rgba(61,220,151,.09)", borderBottom: "1px solid rgba(61,220,151,.16)" }} />
      )}
      <div style={{ padding: "20px 22px 0" }}>
        <div className="skeleton h-3.5 w-24 mb-2" />
        <div className="skeleton h-2.5 w-16" />
      </div>
      <div style={{ padding: "16px 22px 0" }}>
        <div className="skeleton h-9 w-36 mb-2" />
        <div className="skeleton h-2.5 w-28" />
      </div>
      <div style={{ padding: "16px 22px 20px" }}>
        <div className="skeleton rounded-md h-10 w-full" />
      </div>
      <div style={{ height: 1, margin: "0 22px", background: "rgba(255,255,255,.06)" }} />
      <div style={{ padding: "16px 22px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
        {[80, 64, 72, 56, 68].map((w, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className="skeleton rounded-full" style={{ width: 14, height: 14, flexShrink: 0 }} />
            <div className="skeleton h-2.5" style={{ width: w }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── SubscribeModal ───────────────────────────────────────────────────── */
function SubscribeModal({
  plan,
  userEmail,
  onClose,
}: {
  plan: BillingPlan;
  userEmail: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const Illustration = PLAN_ILLUSTRATION[plan.planKey] ?? StarterIllustration;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleContinue = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = await initializeCheckout(plan.variantId, userEmail);
      window.location.href = url;
    } catch {
      setError("Couldn't open checkout. Please try again.");
      setLoading(false);
    }
  };

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,.72)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        className="panel"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 380, width: "100%", overflow: "hidden" }}
      >
        {/* illustration */}
        <div style={{ padding: "1.25rem 1.25rem 0.5rem" }}>
          <div style={{ maxWidth: 180, margin: "0 auto" }}>
            <Illustration />
          </div>
        </div>

        {/* plan name + desc */}
        <div style={{ padding: "0.5rem 1.25rem 1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{plan.name}</span>
            {plan.highlight && <span className="badge badge-green">Popular</span>}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.55 }}>{plan.desc}</div>
        </div>

        <div style={{ margin: "0 1.25rem", height: 1, background: "var(--line)" }} />

        {/* price row */}
        <div style={{ padding: "0.875rem 1.25rem", display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            {plan.interval === "yearly" ? "Billed annually" : "Billed monthly"}
          </span>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 20, fontWeight: 700 }}>{plan.price}</span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>/mo</span>
            {plan.priceNote && (
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{plan.priceNote}</div>
            )}
          </div>
        </div>

        <div style={{ margin: "0 1.25rem", height: 1, background: "var(--line)" }} />

        {/* actions */}
        <div style={{ padding: "1rem 1.25rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {error && (
            <div style={{
              fontSize: 11, color: "#f87171", padding: "0.5rem 0.75rem",
              background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.2)",
              borderRadius: 6, marginBottom: "0.25rem",
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleContinue}
            disabled={loading}
            style={{
              padding: "0.625rem", borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: loading ? "rgba(255,255,255,.04)" : "var(--success-bg)",
              color: loading ? "rgba(255,255,255,.3)" : "var(--success)",
              border: `1px solid ${loading ? "rgba(255,255,255,.06)" : "var(--success-border)"}`,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Opening checkout…" : "Continue to Paystack →"}
          </button>

          <button
            onClick={onClose}
            style={{
              padding: "0.375rem", fontSize: 11, color: "var(--muted)",
              background: "transparent", border: "none", cursor: "pointer",
            }}
          >
            Cancel
          </button>

          <div style={{ fontSize: 10, color: "rgba(255,255,255,.22)", textAlign: "center", marginTop: "0.25rem" }}>
            Secure checkout · Powered by Paystack · Cancel anytime
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── ActiveSubscriptionCard ───────────────────────────────────────────── */
const TIER_FEATURES: Record<string, string[]> = {
  Starter:        ["1 Trading Agent", "Live signal delivery", "Automatic MT5 execution", "Customer dashboard"],
  Pro:            ["3 Trading Agents", "Live signal delivery", "Multi-account support", "Customer dashboard"],
  Infrastructure: ["Unlimited Agents", "Live signal delivery", "Dedicated infrastructure", "Priority support"],
};

function ActiveSubscriptionCard({
  license,
  tierName,
  fmtExpiry,
}: {
  license: { expires_at: string | null; max_devices: number };
  tierName: string;
  fmtExpiry: (iso: string | null) => string;
}) {
  const features = TIER_FEATURES[tierName] ?? TIER_FEATURES.Starter;
  return (
    <div style={{
      background: "rgba(255,255,255,.025)",
      border: "1px solid rgba(255,255,255,.09)",
      borderRadius: 14, display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Banner */}
      <div style={{ padding: "8px 22px", background: "rgba(61,220,151,.09)", borderBottom: "1px solid rgba(61,220,151,.16)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "#3ddc97" }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#3ddc97", boxShadow: "0 0 6px #3ddc97", flexShrink: 0 }} />
        Active Plan
      </div>

      {/* Name + agents badge */}
      <div style={{ padding: "22px 22px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>AQ {tierName}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", lineHeight: 1.55 }}>Your current subscription</div>
        </div>
        <div style={{ flexShrink: 0, padding: "4px 10px", borderRadius: 6, background: "rgba(61,220,151,.1)", border: "1px solid rgba(61,220,151,.22)", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#3ddc97" }}>
          {license.max_devices} {license.max_devices === 1 ? "Agent" : "Agents"}
        </div>
      </div>

      {/* Renewal */}
      <div style={{ padding: "18px 22px 20px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,.32)", marginBottom: 4 }}>Renewal date</div>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" }}>
          {fmtExpiry(license.expires_at)}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <a href="/app/licenses" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "rgba(61,220,151,.09)", color: "#3ddc97", border: "1px solid rgba(61,220,151,.2)", textDecoration: "none" }}>
          Manage License <ArrowRight size={12} />
        </a>
      </div>

      {/* Features */}
      <div style={{ padding: "18px 22px 24px", flex: 1 }}>
        <ul style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {features.map((f) => {
            const Icon = featureIcon(f);
            return (
              <li key={f} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: "rgba(61,220,151,.09)", border: "1px solid rgba(61,220,151,.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={15} style={{ color: "#3ddc97" }} />
                </div>
                <span style={{ fontSize: 12.5, color: "rgba(255,255,255,.65)", lineHeight: 1.4 }}>{f}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ── Feature icon map ─────────────────────────────────────────────────── */
function featureIcon(feature: string): LucideIcon {
  const f = feature.toLowerCase();
  if (f.includes("agent") || f.includes("bot"))              return Bot;
  if (f.includes("signal"))                                   return Radio;
  if (f.includes("execution") || f.includes("mt5"))          return Zap;
  if (f.includes("multi") || f.includes("account"))          return Users;
  if (f.includes("dashboard"))                                return LayoutDashboard;
  if (f.includes("key") || f.includes("license") || f.includes("activation")) return Key;
  if (f.includes("vps") || f.includes("server") || f.includes("infrastructure")) return Server;
  if (f.includes("risk") || f.includes("shield"))            return Shield;
  if (f.includes("support") || f.includes("priority"))       return Headphones;
  return CheckCircle2;
}

/* ── PlanCard ─────────────────────────────────────────────────────────── */
function PlanCard({
  plan,
  onSubscribe,
  activeLicenseDevices,
}: {
  plan: BillingPlan;
  onSubscribe: (plan: BillingPlan) => void;
  activeLicenseDevices: number | null;
}) {
  const hl = plan.highlight;
  const divider = `1px solid ${hl ? "rgba(61,220,151,.1)" : "rgba(255,255,255,.06)"}`;

  return (
    <div
      className="h-full"
      style={{
        background: hl
          ? "radial-gradient(ellipse 90% 50% at 50% 0%, rgba(61,220,151,.18) 0%, transparent 100%), rgba(255,255,255,.028)"
          : "rgba(255,255,255,.025)",
        border: `1px solid ${hl ? "rgba(61,220,151,.3)" : "rgba(255,255,255,.09)"}`,
        borderRadius: 14, position: "relative", display: "flex", flexDirection: "column", overflow: "hidden",
        ...(hl ? { transform: "translateY(-4px)" } : {}),
      }}
    >
      {hl && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(61,220,151,.85) 35%, rgba(61,220,151,.85) 65%, transparent)", zIndex: 1 }} />}

      {/* Most Popular banner */}
      {hl && (
        <div style={{ padding: "8px 22px", background: "rgba(61,220,151,.09)", borderBottom: "1px solid rgba(61,220,151,.16)", fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "#3ddc97", textAlign: "center" }}>
          Most Popular
        </div>
      )}

      {/* Name + agents */}
      <div style={{ padding: "22px 22px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{plan.name}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", lineHeight: 1.55 }}>{plan.desc}</div>
        </div>
        {plan.interval !== "custom" && (
          <div style={{ flexShrink: 0, padding: "4px 10px", borderRadius: 6, background: hl ? "rgba(61,220,151,.1)" : "rgba(255,255,255,.05)", border: `1px solid ${hl ? "rgba(61,220,151,.22)" : "rgba(255,255,255,.08)"}`, fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: hl ? "#3ddc97" : "rgba(255,255,255,.45)" }}>
            {plan.devices} {plan.devices === 1 ? "Agent" : "Agents"}
          </div>
        )}
      </div>

      {/* Price */}
      <div style={{ padding: "18px 22px 20px", borderBottom: divider }}>
        {plan.interval === "custom" ? (
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.025em" }}>Custom</div>
        ) : (
          <>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1 }}>
              {plan.price}
              <span style={{ fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,.38)", marginLeft: "0.4rem" }}>/mo</span>
            </div>
            {plan.priceNote && <div style={{ fontSize: 11, color: "rgba(255,255,255,.32)", marginTop: 6 }}>{plan.priceNote}</div>}
            {plan.trialDays && (
              <div className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-md" style={{ background: "var(--success-bg)", border: "1px solid var(--success-border)" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--success)" }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--success)" }}>{plan.trialDays}-day free trial</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* CTA */}
      <div style={{ padding: "16px 22px", borderBottom: divider }}>
        {plan.interval === "custom" ? (
          <a href="mailto:support@apexquantel.io" className="block text-center rounded-md text-[13px] font-semibold transition-opacity hover:opacity-80" style={{ padding: "11px 0", background: "rgba(255,255,255,.05)", color: "rgba(255,255,255,.55)", border: "1px solid rgba(255,255,255,.09)" }}>
            Contact us
          </a>
        ) : activeLicenseDevices === plan.devices ? (
          <div className="flex items-center justify-center rounded-md text-[13px] font-semibold w-full" style={{ padding: "11px 0", background: "rgba(255,255,255,.03)", color: "rgba(255,255,255,.25)", border: "1px solid rgba(255,255,255,.06)", cursor: "default" }}>
            Current plan
          </div>
        ) : (
          <button onClick={() => onSubscribe(plan)} className="flex items-center justify-center gap-2 rounded-md text-[13px] font-semibold w-full transition-opacity hover:opacity-85" style={{ padding: "11px 0", ...(hl ? { background: "#3ddc97", color: "#03120c" } : { background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.8)", border: "1px solid rgba(255,255,255,.12)" }) }}>
            {activeLicenseDevices !== null && plan.devices > activeLicenseDevices ? "Upgrade" : "Subscribe"} <ExternalLink size={12} />
          </button>
        )}
      </div>

      {/* Features */}
      <div style={{ padding: "18px 22px 24px", flex: 1 }}>
        <ul style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {plan.features.slice(0, 5).map((f) => {
            const Icon = featureIcon(f);
            return (
              <li key={f} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: hl ? "rgba(61,220,151,.09)" : "rgba(255,255,255,.04)",
                  border: `1px solid ${hl ? "rgba(61,220,151,.18)" : "rgba(255,255,255,.08)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={15} style={{ color: hl ? "#3ddc97" : "rgba(255,255,255,.45)" }} />
                </div>
                <span style={{ fontSize: 12.5, color: "rgba(255,255,255,.65)", lineHeight: 1.4 }}>{f}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ── page ─────────────────────────────────────────────────────────────── */
export default function Billing() {
  const { session } = useAuth();
  const userEmail   = session?.user.email ?? null;

  const [plans, setPlans]               = useState<BillingPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [interval, setInterval]         = useState<"monthly" | "yearly">("yearly");
  const [selectedPlan, setSelectedPlan] = useState<BillingPlan | null>(null);
  // undefined = still checking, null = no active license, object = has one
  const [activeLicense, setActiveLicense] = useState<{ id: string; expires_at: string | null; max_devices: number } | null | undefined>(undefined);

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

  useEffect(() => {
    if (!session) return;
    const sb = getBrowserSupabase();
    sb.from("licenses")
      .select("id, expires_at, max_devices")
      .eq("status", "active")
      .limit(1)
      .then(({ data }) => setActiveLicense((data?.[0] as typeof activeLicense) ?? null));
  }, [session]);

  const visiblePlans  = plans.filter((p) => p.interval === interval || p.interval === "custom");
  const storeCurrency = plans[0]?.currency ?? null;

  const tierName = activeLicense
    ? activeLicense.max_devices >= 9999 ? "Infrastructure"
      : activeLicense.max_devices >= 3  ? "Pro"
      : "Starter"
    : null;

  const fmtExpiry = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <div className="page-wrap">

      {/* ── Plans + Active subscription ───────────────────────────────── */}
      <section>
        {/* header */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "1rem", marginBottom: "1.75rem" }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.01em", marginBottom: "0.3rem" }}>
              Plans{storeCurrency ? <span style={{ fontWeight: 400, fontSize: 16, color: "rgba(255,255,255,.35)", marginLeft: "0.5rem" }}>{storeCurrency}</span> : ""}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.4)" }}>
              Device count is the only difference between plans.
            </div>
          </div>
          {plansLoading
            ? <div className="skeleton h-8 w-40 rounded-full" />
            : plans.length > 0 && <IntervalToggle value={interval} onChange={setInterval} />
          }
        </div>

        {plansLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch" style={{ maxWidth: 840, margin: "0 auto" }}>
            <PlanCardSkeleton />
            <PlanCardSkeleton highlight />
          </div>
        )}

        {!plansLoading && plans.length === 0 && (
          <div className="panel p-4 flex items-center gap-3">
            <CreditCard size={16} className="muted shrink-0" />
            <div>
              <div className="text-sm font-medium">Plans coming soon</div>
              <p className="muted text-xs mt-0.5">Pricing will be available here shortly.</p>
            </div>
          </div>
        )}

        {!plansLoading && visiblePlans.length > 0 && (
          <div
            className={`grid grid-cols-1 gap-4 items-stretch ${activeLicense ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
            style={{ maxWidth: activeLicense ? 1240 : 840, margin: "0 auto", paddingBottom: 8 }}
          >
            {activeLicense && (
              <ActiveSubscriptionCard license={activeLicense} tierName={tierName ?? "Starter"} fmtExpiry={fmtExpiry} />
            )}
            {visiblePlans.map((plan) => (
              <PlanCard key={plan.variantId} plan={plan} onSubscribe={setSelectedPlan} activeLicenseDevices={activeLicense?.max_devices ?? null} />
            ))}
          </div>
        )}
      </section>

      {/* ── Subscribe modal ────────────────────────────────────────────── */}
      {selectedPlan && userEmail && (
        <SubscribeModal
          plan={selectedPlan}
          userEmail={userEmail}
          onClose={() => setSelectedPlan(null)}
        />
      )}
    </div>
  );
}
