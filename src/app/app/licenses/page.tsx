"use client";

import { getBrowserSupabase } from "@/lib/supabase-singleton";
import { useAuth } from "@/components/auth-provider";
import { PageHeader, SectionHead } from "@/components/metric-detail";
import { gatewayHttpBase } from "@/lib/gateway";
import { Copy, X } from "lucide-react";
import { ErrorIcon, LicenseKeyIcon, ShieldIcon, SuccessIcon, WarningIcon } from "@/components/icons";
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
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
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
              <LicenseKeyIcon size={16} className="text-[#3ddc97]" />
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
          <div className="text-xs font-bold uppercase tracking-wider text-[#f5b942] mb-1">Copy now - shown once</div>
          <p className="text-xs muted leading-5">
            This key will not be displayed again. Apex Quantel stores only the hash.
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
              {copied ? <><SuccessIcon size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
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
            <WarningIcon size={16} className="text-[#f43f5e]" />
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

/* ── Step illustrations (200 × 88 viewBox, matches billing page style) ── */
function SubscribeIllustration() {
  return (
    <svg viewBox="0 0 200 88" fill="none" className="w-full h-auto">
      {/* subscription card body */}
      <rect x="18" y="16" width="80" height="56" rx="7"
            fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.09)" strokeWidth="1"/>
      {/* card header band */}
      <rect x="18" y="16" width="80" height="18" rx="7"
            fill="rgba(255,255,255,.06)"/>
      <rect x="18" y="30" width="80" height="4" fill="rgba(255,255,255,.06)"/>
      {/* chip */}
      <rect x="27" y="42" width="16" height="12" rx="2.5"
            fill="rgba(61,220,151,.15)" stroke="rgba(61,220,151,.3)" strokeWidth="1"/>
      <line x1="31" y1="42" x2="31" y2="54" stroke="rgba(61,220,151,.35)" strokeWidth=".7"/>
      <line x1="35" y1="42" x2="35" y2="54" stroke="rgba(61,220,151,.35)" strokeWidth=".7"/>
      <line x1="27" y1="47" x2="43" y2="47" stroke="rgba(61,220,151,.35)" strokeWidth=".7"/>
      {/* card number dots */}
      <circle cx="52" cy="45" r="1.5" fill="rgba(255,255,255,.18)"/>
      <circle cx="57" cy="45" r="1.5" fill="rgba(255,255,255,.18)"/>
      <circle cx="62" cy="45" r="1.5" fill="rgba(255,255,255,.18)"/>
      <circle cx="67" cy="45" r="1.5" fill="rgba(255,255,255,.18)"/>
      {/* expiry line */}
      <rect x="27" y="60" width="26" height="2.5" rx="1.25" fill="rgba(255,255,255,.1)"/>
      <rect x="59" y="60" width="16" height="2.5" rx="1.25" fill="rgba(255,255,255,.07)"/>
      {/* arrow */}
      <line x1="106" y1="44" x2="122" y2="44"
            stroke="rgba(255,255,255,.12)" strokeWidth="1.1" strokeDasharray="2.5,2.5"/>
      <polyline points="119,40.5 123,44 119,47.5"
                stroke="rgba(255,255,255,.2)" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
      {/* shield */}
      <path d="M135 22 L135 14 Q135 12 137 12 L153 12 Q155 12 155 14 L155 22 Q155 32 145 36 Q135 32 135 22Z"
            fill="rgba(61,220,151,.1)" stroke="rgba(61,220,151,.35)" strokeWidth="1.2"/>
      <path d="M140 23 L143.5 27 L151 19" stroke="#3ddc97" strokeWidth="1.5" fill="none"
            strokeLinecap="round" strokeLinejoin="round"/>
      {/* license rows below shield */}
      <rect x="128" y="44" width="44" height="2.5" rx="1.25" fill="rgba(255,255,255,.1)"/>
      <rect x="128" y="50" width="36" height="2.5" rx="1.25" fill="rgba(255,255,255,.07)"/>
      <rect x="128" y="56" width="28" height="2.5" rx="1.25" fill="rgba(255,255,255,.05)"/>
      {/* status dot */}
      <circle cx="145" cy="70" r="3" fill="#3ddc97" opacity=".75"/>
      <circle cx="145" cy="70" r="6" fill="#3ddc97" fillOpacity=".08"/>
      {/* glow */}
      <ellipse cx="145" cy="24" rx="20" ry="12" fill="#3ddc97" fillOpacity=".04"/>
    </svg>
  );
}

function KeyIllustration() {
  return (
    <svg viewBox="0 0 200 88" fill="none" className="w-full h-auto">
      {/* modal frame */}
      <rect x="22" y="8" width="156" height="72" rx="8"
            fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.09)" strokeWidth="1"/>
      {/* header band */}
      <rect x="22" y="8" width="156" height="20" rx="8"
            fill="rgba(255,255,255,.06)"/>
      <rect x="22" y="24" width="156" height="4" fill="rgba(255,255,255,.06)"/>
      {/* key icon in header */}
      <circle cx="40" cy="18" r="5.5" fill="none" stroke="rgba(61,220,151,.45)" strokeWidth="1.2"/>
      <circle cx="40" cy="18" r="2" fill="rgba(61,220,151,.3)" stroke="#3ddc97" strokeWidth=".9"/>
      <rect x="45" y="16.5" width="11" height="3" rx="1.5" fill="rgba(255,255,255,.12)"/>
      <rect x="50" y="19.5" width="3" height="4" rx="1" fill="rgba(255,255,255,.12)"/>
      <rect x="54" y="19.5" width="3" height="6" rx="1" fill="rgba(255,255,255,.12)"/>
      {/* "New activation key" title lines */}
      <rect x="62" y="14" width="42" height="2.5" rx="1.25" fill="rgba(255,255,255,.2)"/>
      <rect x="62" y="19" width="30" height="2" rx="1" fill="rgba(255,255,255,.1)"/>
      {/* warning strip */}
      <rect x="30" y="32" width="140" height="16" rx="4"
            fill="rgba(245,185,66,.07)" stroke="rgba(245,185,66,.22)" strokeWidth=".8"/>
      <rect x="36" y="36" width="48" height="2.5" rx="1.25" fill="rgba(245,185,66,.4)"/>
      <rect x="36" y="40.5" width="80" height="2" rx="1" fill="rgba(245,185,66,.2)"/>
      {/* key code block */}
      <rect x="30" y="53" width="116" height="14" rx="4"
            fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.1)" strokeWidth=".8"/>
      <rect x="36" y="57" width="72" height="2.5" rx="1.25" fill="rgba(61,220,151,.45)"/>
      <rect x="36" y="61.5" width="50" height="2" rx="1" fill="rgba(61,220,151,.22)"/>
      {/* copy button */}
      <rect x="150" y="53" width="20" height="14" rx="4"
            fill="rgba(255,255,255,.07)" stroke="rgba(255,255,255,.12)" strokeWidth=".8"/>
      <rect x="154" y="57" width="12" height="2" rx="1" fill="rgba(255,255,255,.4)"/>
      <rect x="154" y="61" width="9" height="2" rx="1" fill="rgba(255,255,255,.25)"/>
      {/* glow under key block */}
      <ellipse cx="100" cy="60" rx="55" ry="8" fill="#3ddc97" fillOpacity=".03"/>
    </svg>
  );
}

function ActivateIllustration() {
  return (
    <svg viewBox="0 0 200 88" fill="none" className="w-full h-auto">
      {/* config file */}
      <rect x="8" y="12" width="52" height="64" rx="5"
            fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.08)" strokeWidth="1"/>
      {/* dog-ear */}
      <path d="M48 12 L60 24 L48 24 Z" fill="rgba(255,255,255,.07)"/>
      <line x1="48" y1="12" x2="60" y2="24" stroke="rgba(255,255,255,.09)" strokeWidth="1"/>
      {/* yaml lines */}
      <rect x="14" y="30" width="26" height="2" rx="1" fill="rgba(255,255,255,.1)"/>
      <rect x="14" y="36" width="20" height="2" rx="1" fill="rgba(255,255,255,.07)"/>
      <rect x="14" y="42" width="32" height="2.5" rx="1.25" fill="rgba(61,220,151,.45)"/>
      <rect x="14" y="47" width="24" height="2.5" rx="1.25" fill="rgba(61,220,151,.28)"/>
      <rect x="14" y="53" width="18" height="2" rx="1" fill="rgba(255,255,255,.07)"/>
      <rect x="14" y="59" width="22" height="2" rx="1" fill="rgba(255,255,255,.05)"/>
      {/* key icon (unlocking) */}
      <circle cx="95" cy="32" r="12" fill="rgba(61,220,151,.07)" stroke="rgba(61,220,151,.22)" strokeWidth="1.2"/>
      <circle cx="95" cy="32" r="5" fill="none" stroke="rgba(61,220,151,.5)" strokeWidth="1.3"/>
      <circle cx="95" cy="32" r="2" fill="rgba(61,220,151,.4)" stroke="#3ddc97" strokeWidth="1"/>
      <rect x="99" y="30.5" width="16" height="3" rx="1.5" fill="rgba(255,255,255,.15)"/>
      <rect x="108" y="33.5" width="4" height="5" rx="1" fill="rgba(255,255,255,.15)"/>
      <rect x="113" y="33.5" width="4" height="7" rx="1" fill="rgba(255,255,255,.15)"/>
      {/* arrows */}
      <line x1="66" y1="44" x2="80" y2="44"
            stroke="rgba(255,255,255,.1)" strokeWidth="1" strokeDasharray="2,2"/>
      <line x1="112" y1="44" x2="126" y2="44"
            stroke="rgba(61,220,151,.25)" strokeWidth="1" strokeDasharray="2,2"/>
      {/* engine chip */}
      <rect x="128" y="28" width="44" height="40" rx="5"
            fill="rgba(61,220,151,.06)" stroke="rgba(61,220,151,.2)" strokeWidth="1"/>
      <rect x="135" y="34" width="30" height="28" rx="3"
            fill="rgba(255,255,255,.025)" stroke="rgba(61,220,151,.1)" strokeWidth="1"/>
      <polyline points="137,48 141,48 144,40 147,56 150,40 153,56 156,48 157,48"
                stroke="#3ddc97" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity=".9"/>
      <ellipse cx="150" cy="48" rx="13" ry="7" fill="#3ddc97" fillOpacity=".05"/>
      {/* live dot */}
      <circle cx="150" cy="73" r="2.5" fill="#3ddc97" opacity=".75"/>
      <circle cx="150" cy="73" r="5" fill="#3ddc97" fillOpacity=".09"/>
    </svg>
  );
}

/* wave-edge badge style (matches billing page Trading Agent badge) */
const WAVE_BADGE: React.CSSProperties = {
  display: "inline-block",
  background: "rgba(255,255,255,.022)",
  color: "rgba(255,255,255,.65)",
  fontWeight: 900,
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  padding: "7px 16px",
  WebkitMaskImage: [
    "radial-gradient(circle at 50% 0%,   transparent 5px, white 5.5px)",
    "radial-gradient(circle at 50% 100%, transparent 5px, white 5.5px)",
    "linear-gradient(white, white)",
  ].join(", "),
  WebkitMaskSize:     "10px 10px, 10px 10px, 100% calc(100% - 10px)",
  WebkitMaskPosition: "top, bottom, 0 5px",
  WebkitMaskRepeat:   "repeat-x, repeat-x, no-repeat",
  maskImage: [
    "radial-gradient(circle at 50% 0%,   transparent 5px, white 5.5px)",
    "radial-gradient(circle at 50% 100%, transparent 5px, white 5.5px)",
    "linear-gradient(white, white)",
  ].join(", "),
  maskSize:     "10px 10px, 10px 10px, 100% calc(100% - 10px)",
  maskPosition: "top, bottom, 0 5px",
  maskRepeat:   "repeat-x, repeat-x, no-repeat",
};

/* ── No-licenses empty state ─────────────────────────────────────────── */
function NoLicensesState() {
  const steps = [
    {
      Illustration: SubscribeIllustration,
      badge: "Step 1",
      name: "Subscribe to a plan",
      desc: "Choose Starter or Pro on the Billing page. After checkout, a license is provisioned automatically with the correct device slot count.",
      features: ["Starter - 1 Trading Agent", "Pro - 3 Trading Agents", "License created instantly", "Keys issued server-side"],
      cta: { label: "Go to Billing →", href: "/app/billing", active: true },
    },
    {
      Illustration: KeyIllustration,
      badge: "Step 2",
      name: "Issue your activation key",
      desc: "Your license card appears here after subscribing. Click Issue key - the raw key is shown exactly once and never stored in plain text.",
      features: ["Raw key shown once only", "Hash stored server-side", "Browser never holds the key", "Rotate anytime from this page"],
      cta: { label: "Keys appear here after subscribing", href: null, active: false },
    },
    {
      Illustration: ActivateIllustration,
      badge: "Step 3",
      name: "Activate & connect",
      desc: "Paste the key into AQ Agent's config.yaml under gateway.activation_key. AQ Agent authenticates and streams live data to My Execution.",
      features: ["Install AQ Agent on Windows PC or VPS", "Paste key into config.yaml", "AQ Agent auto-connects to gateway", "Metrics stream in real time"],
      cta: { label: "View My Execution →", href: "/app/execution", active: true },
    },
  ];

  return (
    <div className="flex justify-center mt-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-4xl">
        {steps.map(({ Illustration, badge, name, desc, features, cta }) => (
          <div key={name}
               className="panel flex flex-col overflow-hidden"
               style={{ border: "none" }}>

            {/* Illustration */}
            <div className="px-4 pt-4 pb-1">
              <Illustration />
            </div>

            {/* Header */}
            <div className="px-5 pt-2 pb-4">
              <div className="text-sm font-semibold mb-0.5">{name}</div>
              <div className="text-[11px] muted leading-snug">{desc}</div>
              <div className="mt-3" style={WAVE_BADGE}>{badge}</div>
            </div>

            {/* Body */}
            <div className="px-5 pt-1 pb-5 flex flex-col flex-1">
              <ul className="mb-5 flex flex-col gap-1.5" style={{ minHeight: 88 }}>
                {features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-[11px] muted">
                    <span className="w-1 h-1 rounded-full shrink-0"
                          style={{ background: "var(--success)", opacity: 0.7 }} />
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {cta.href ? (
                <a href={cta.href}
                   className="flex items-center justify-center py-2.5 rounded text-xs font-semibold transition-opacity hover:opacity-80"
                   style={{ background: "rgba(61,220,151,.1)", color: "#3ddc97", border: "1px solid rgba(61,220,151,.25)", textDecoration: "none" }}>
                  {cta.label}
                </a>
              ) : (
                <div className="flex items-center justify-center py-2.5 rounded text-xs font-semibold"
                     style={{ background: "rgba(255,255,255,.03)", color: "rgba(255,255,255,.25)", border: "1px solid rgba(255,255,255,.06)" }}>
                  {cta.label}
                </div>
              )}
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}

/* ── page ────────────────────────────────────────────────────────────── */
/* ── AQ Agent download card (shown when license exists but no AQ Agent connected yet) ── */
function EngineDownloadCard() {
  const [info, setInfo] = useState<{ version: string; download_url: string | null } | null>(null);

  useEffect(() => {
    fetch(`${gatewayHttpBase()}/engine-version`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setInfo(d as { version: string; download_url: string | null }))
      .catch(() => null);
  }, []);

  return (
    <div className="panel overflow-hidden mt-6" style={{ border: "none" }}>
      {/* header strip */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between gap-4 flex-wrap"
           style={{ borderBottom: "1px solid rgba(255,255,255,.05)" }}>
        <div className="flex items-center gap-3">
          {/* chip icon */}
          <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0"
               style={{ background: "rgba(61,220,151,.1)", border: "1px solid rgba(61,220,151,.25)" }}>
            <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
              <rect x="3" y="3" width="14" height="14" rx="3"
                    fill="none" stroke="#3ddc97" strokeWidth="1.4"/>
              <rect x="6" y="6" width="8" height="8" rx="1.5"
                    fill="none" stroke="rgba(61,220,151,.5)" strokeWidth="1"/>
              <polyline points="6,10 7.5,10 8.5,7.5 9.5,12.5 10.5,7.5 11.5,12.5 12.5,10 14,10"
                        stroke="#3ddc97" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold">AQ Agent</div>
            <div className="text-xs muted mt-0.5">
              {info ? `v${info.version} · Windows 10/11 or Server` : "Fetching version info…"}
            </div>
          </div>
        </div>

        {/* download CTA */}
        {info?.download_url ? (
          <a href={info.download_url}
             className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
             style={{ background: "rgba(61,220,151,.12)", color: "#3ddc97", border: "1px solid rgba(61,220,151,.28)", textDecoration: "none" }}>
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
              <line x1="8" y1="2" x2="8" y2="10" stroke="#3ddc97" strokeWidth="1.5" strokeLinecap="round"/>
              <polyline points="4,7 8,11 12,7" stroke="#3ddc97" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="2" y1="14" x2="14" y2="14" stroke="#3ddc97" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Download installer
          </a>
        ) : (
          <span className="text-xs muted px-4 py-2 rounded-lg"
                style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)" }}>
            {info ? "Download not configured" : "Loading…"}
          </span>
        )}
      </div>

      {/* next steps row */}
      <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-[11px]">
        {[
          { n: "1", label: "Run the installer", body: "Execute the .exe on your Windows PC or VPS and follow the setup wizard." },
          { n: "2", label: "Paste your activation key", body: "Open config.yaml and set gateway.activation_key to the key you issued above." },
          { n: "3", label: "Start AQ Agent", body: "Run AQ Agent. It registers here automatically and begins streaming to My Execution." },
        ].map(({ n, label, body }) => (
          <div key={n} className="flex gap-3">
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5"
                  style={{ background: "rgba(61,220,151,.12)", border: "1px solid rgba(61,220,151,.28)", color: "#3ddc97" }}>
              {n}
            </span>
            <div>
              <div className="font-semibold text-white/70 mb-0.5">{label}</div>
              <div className="muted leading-relaxed">{body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Licenses() {
  const supabase  = getBrowserSupabase();
  const { session } = useAuth();
  const [licenses, setLicenses] = useState<LicenseView[]>([]);
  const [totalEngines, setTotalEngines] = useState(0);
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
        ? supabase
            .from("engine_devices")
            .select("license_id,id")
            .in("license_id", ids)
            .eq("status", "active")
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

    setTotalEngines((devResult.data ?? []).length);
    setLicenses(rows.map(r => ({
      ...r,
      symbols:     symbolsByLicense.get(r.id) ?? [],
      usedDevices: deviceCountByLicense.get(r.id) ?? 0,
    })));
    setError(null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  // 3.14 - Live push: refresh when any of the user's licenses change in the DB.
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
        description="Activation keys are issued server-side and displayed once. Apex Quantel stores only the keyed hash - the browser never generates, derives, or holds raw keys."
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
            <ErrorIcon size={14} /> {error}
          </div>
        </div>
      )}

      {/* Action error */}
      {actionError && (
        <div className="panel p-4 mt-2 flex items-center justify-between gap-3"
             style={{ borderColor: "rgba(244,63,94,.3)", background: "rgba(244,63,94,.05)" }}>
          <div className="flex items-center gap-2 text-[#f43f5e] text-sm">
            <ErrorIcon size={14} /> {actionError}
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

      {/* Empty - no license yet */}
      {!loading && !error && supabase && licenses.length === 0 && <NoLicensesState />}

      {/* Has license but no engine connected - show install prompt */}
      {!loading && licenses.length > 0 && totalEngines === 0 && <EngineDownloadCard />}

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
                  <ShieldIcon size={16} className="text-[#3ddc97]" />
                </div>
                <div>
                  <div className="font-semibold">Apex Quantel License</div>
                  <div className="text-xs muted mt-0.5 mono">{lic.id}</div>
                </div>
              </div>
              <span className={`badge ${statusBadge} w-fit`}>{lic.status}</span>
            </div>

            {/* Details */}
            <div className="panel-body grid grid-cols-2 sm:grid-cols-4 gap-5 text-sm">
              <div>
                <div className="muted text-xs">Registered slot limit</div>
                <div className="mt-2 mono font-medium">{lic.max_devices}</div>
              </div>
              <div>
                <div className="muted text-xs">Registered slots used</div>
                <div className="mt-2 mono font-medium">{lic.usedDevices}</div>
              </div>
              <div>
                <div className="muted text-xs">Symbols</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {lic.symbols.length > 0
                    ? lic.symbols.map(s => (
                        <span key={s} className="badge badge-muted mono">{s}</span>
                      ))
                    : <span className="mono font-medium text-xs">-</span>}
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
                      {isActive ? "Key hash on file" : isSuspended ? "Key revoked - license suspended" : "No key on file"}
                    </div>
                    <div className="text-xs muted mt-0.5 leading-5">
                      {isActive
                        ? "The raw key was shown once at issuance. Rotate to generate a replacement - the old key is immediately invalidated."
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
                      <LicenseKeyIcon size={12} />
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
                        <WarningIcon size={12} /> Revoke
                      </button>
                    )}
                  </div>
                </div>

                {/* Key security notice */}
                <div className="panel p-4" style={{ borderColor: "rgba(245,185,66,.2)", background: "rgba(245,185,66,.04)" }}>
                  <div className="text-xs font-bold uppercase tracking-wider text-[#f5b942] mb-2">Key security</div>
                  <p className="muted text-xs leading-5">
                    Raw keys are shown once at issuance and never stored in plain text.
                    Apex Quantel stores only a keyed HMAC hash. The browser never generates or hashes activation keys.
                    Rotating immediately invalidates the previous key - re-activate any affected engines with the new key.
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
