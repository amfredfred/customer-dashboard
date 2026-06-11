"use client";

import { getBrowserSupabase } from "@/lib/supabase-singleton";
import { gatewayHttpBase } from "@/lib/gateway";
import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/metric-detail";
import { ErrorIcon } from "@/components/icons";
import { useCallback, useEffect, useState } from "react";

/* ── types ────────────────────────────────────────────────────────────── */
type EngineDevice = {
  id: string;
  license_id: string;
  engine_id: string;
  device_name: string;
  platform: Record<string, unknown>;
  engine_version: string;
  status: string;
  activated_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
};
type License = {
  id: string;
  status: string;
  max_devices: number;
  expires_at: string | null;
};
type EngineSession = {
  engine_device_id: string;
  connected_at: string;
  disconnected_at: string | null;
  disconnect_reason: string | null;
  last_heartbeat_at: string | null;
  metadata: Record<string, unknown>;
};
type Mt5Account = { login: string; server: string; mode?: string };
type EngineView = EngineDevice & {
  license?: License;
  symbols: string[];
  session?: EngineSession;
  usedSlots: number;
  account?: Mt5Account;
};

/* ── constants ────────────────────────────────────────────────────────── */
const ONLINE_MS   = 90_000;
const DEGRADED_MS = 300_000;

/* ── helpers ──────────────────────────────────────────────────────────── */
function engineState(
  engine: EngineView,
  nowMs: number
): "online" | "degraded" | "offline" {
  if (engine.status !== "active") return "offline";
  if (engine.license?.status !== "active") return "offline";
  if (!engine.session || engine.session.disconnected_at) return "offline";
  const hb = engine.session.last_heartbeat_at;
  if (!hb || !nowMs) return "offline";
  const age = nowMs - Date.parse(hb);
  if (age <= ONLINE_MS)   return "online";
  if (age <= DEGRADED_MS) return "degraded";
  return "offline";
}

function platformLabel(p: Record<string, unknown>) {
  return [p.os, p.architecture].filter(Boolean).map(String).join(" ") || "Platform unavailable";
}

function mt5Account(
  platform: Record<string, unknown>,
  session?: EngineSession,
): Mt5Account | undefined {
  const value = session?.metadata?.mt5_account ?? platform.mt5_account;
  if (!value || typeof value !== "object") return undefined;
  const account = value as Record<string, unknown>;
  const login = String(account.login ?? "").trim();
  const server = String(account.server ?? "").trim();
  if (!login || !server) return undefined;
  return { login, server, mode: String(account.mode ?? "").trim() || undefined };
}

function timeAgo(value: string | null | undefined, nowMs: number) {
  if (!value) return "Never";
  if (!nowMs) return "Checking…";
  const s = Math.max(0, Math.floor((nowMs - Date.parse(value)) / 1000));
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function StateLabel({ state }: { state: "online" | "degraded" | "offline" }) {
  const dot =
    state === "online"   ? "dot-live pulse"
    : state === "degraded" ? "dot-warn"
    : "dot-dead";
  const label =
    state === "online" ? "Online" : state === "degraded" ? "Degraded" : "Offline";
  return (
    <span className="pill shrink-0">
      <span className={`dot ${dot}`} />
      {label}
    </span>
  );
}

/* ── Step illustrations ───────────────────────────────────────────────── */
function GetKeyIllustration() {
  return (
    <svg viewBox="0 0 200 88" fill="none" className="w-full h-auto">
      {/* shield body */}
      <path d="M68 54 L68 34 Q68 30 72 30 L100 30 Q104 30 104 34 L104 54 Q104 70 86 76 Q68 70 68 54Z"
            fill="rgba(61,220,151,.08)" stroke="rgba(61,220,151,.3)" strokeWidth="1.2"/>
      {/* shield inner check */}
      <path d="M78 52 L84 58 L96 44" stroke="#3ddc97" strokeWidth="1.8" fill="none"
            strokeLinecap="round" strokeLinejoin="round"/>
      {/* glow */}
      <ellipse cx="86" cy="53" rx="22" ry="14" fill="#3ddc97" fillOpacity=".05"/>
      {/* key ring */}
      <circle cx="136" cy="36" r="11" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="1.5"/>
      <circle cx="136" cy="36" r="4.5" fill="rgba(61,220,151,.18)" stroke="rgba(61,220,151,.45)" strokeWidth="1.1"/>
      {/* key shaft */}
      <rect x="145" y="34" width="26" height="4" rx="2" fill="rgba(255,255,255,.13)"/>
      {/* teeth */}
      <rect x="153" y="38" width="3.5" height="6" rx="1.2" fill="rgba(255,255,255,.13)"/>
      <rect x="159" y="38" width="3.5" height="4" rx="1.2" fill="rgba(255,255,255,.13)"/>
      <rect x="165" y="38" width="3.5" height="8" rx="1.2" fill="rgba(255,255,255,.13)"/>
      {/* connect trace shield→key */}
      <path d="M104 53 Q120 53 126 40" stroke="rgba(61,220,151,.22)" strokeWidth="1"
            strokeDasharray="3,2.5" fill="none"/>
      {/* license rows */}
      <rect x="120" y="56" width="56" height="2.5" rx="1.25" fill="rgba(255,255,255,.1)"/>
      <rect x="120" y="62" width="44" height="2.5" rx="1.25" fill="rgba(255,255,255,.07)"/>
      <rect x="120" y="68" width="34" height="2.5" rx="1.25" fill="rgba(255,255,255,.05)"/>
    </svg>
  );
}

function InstallIllustration() {
  return (
    <svg viewBox="0 0 200 88" fill="none" className="w-full h-auto">
      {/* installer window frame */}
      <rect x="14" y="10" width="88" height="68" rx="7"
            fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.09)" strokeWidth="1"/>
      {/* title bar */}
      <rect x="14" y="10" width="88" height="18" rx="7" fill="rgba(255,255,255,.06)"/>
      <rect x="14" y="24" width="88" height="4" fill="rgba(255,255,255,.06)"/>
      {/* traffic lights */}
      <circle cx="24" cy="19" r="2.5" fill="rgba(244,63,94,.35)"/>
      <circle cx="32" cy="19" r="2.5" fill="rgba(245,185,66,.35)"/>
      <circle cx="40" cy="19" r="2.5" fill="rgba(61,220,151,.35)"/>
      {/* apex quantel label */}
      <rect x="50" y="16" width="30" height="3" rx="1.5" fill="rgba(255,255,255,.12)"/>
      {/* chip icon inside window */}
      <rect x="30" y="34" width="28" height="24" rx="4"
            fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.09)" strokeWidth="1"/>
      <rect x="35" y="38" width="18" height="16" rx="2"
            fill="rgba(255,255,255,.025)" stroke="rgba(255,255,255,.06)" strokeWidth="1"/>
      <polyline points="37,46 40,46 42,41 44,51 46,41 48,51 50,46 51,46"
                stroke="#3ddc97" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity=".8"/>
      {/* progress bar */}
      <rect x="24" y="64" width="68" height="5" rx="2.5" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.07)" strokeWidth=".8"/>
      <rect x="24" y="64" width="48" height="5" rx="2.5" fill="rgba(61,220,151,.4)"/>
      {/* download arrow (right side) */}
      <circle cx="148" cy="36" r="18" fill="rgba(61,220,151,.07)" stroke="rgba(61,220,151,.2)" strokeWidth="1.2"/>
      <line x1="148" y1="27" x2="148" y2="38" stroke="#3ddc97" strokeWidth="1.6" strokeLinecap="round"/>
      <polyline points="141,35 148,43 155,35" stroke="#3ddc97" strokeWidth="1.6" fill="none"
                strokeLinecap="round" strokeLinejoin="round"/>
      {/* arrow tail lines */}
      <rect x="137" y="47" width="22" height="2.5" rx="1.25" fill="rgba(61,220,151,.3)"/>
      <rect x="140" y="52" width="16" height="2" rx="1" fill="rgba(61,220,151,.18)"/>
      {/* connect line window→download */}
      <line x1="102" y1="44" x2="128" y2="36"
            stroke="rgba(255,255,255,.08)" strokeWidth="1" strokeDasharray="2.5,2.5"/>
    </svg>
  );
}

function HeartbeatIllustration() {
  return (
    <svg viewBox="0 0 200 88" fill="none" className="w-full h-auto">
      {/* engine chip */}
      <rect x="14" y="24" width="64" height="56" rx="7"
            fill="rgba(61,220,151,.06)" stroke="rgba(61,220,151,.2)" strokeWidth="1"/>
      <rect x="22" y="32" width="48" height="40" rx="4"
            fill="rgba(255,255,255,.025)" stroke="rgba(61,220,151,.1)" strokeWidth="1"/>
      {/* top/bottom pins */}
      <rect x="28" y="14" width="8" height="10" rx="2" fill="rgba(255,255,255,.07)"/>
      <rect x="42" y="14" width="8" height="10" rx="2" fill="rgba(255,255,255,.07)"/>
      <rect x="56" y="14" width="8" height="10" rx="2" fill="rgba(255,255,255,.07)"/>
      <rect x="28" y="80" width="8" height="10" rx="2" fill="rgba(255,255,255,.07)"/>
      <rect x="42" y="80" width="8" height="10" rx="2" fill="rgba(255,255,255,.07)"/>
      <rect x="56" y="80" width="8" height="10" rx="2" fill="rgba(255,255,255,.07)"/>
      {/* heartbeat waveform inside */}
      <polyline points="24,52 28,52 32,40 36,64 40,40 44,64 48,52 52,52 55,46 60,46 63,46"
                stroke="#3ddc97" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".9"/>
      <ellipse cx="46" cy="52" rx="18" ry="10" fill="#3ddc97" fillOpacity=".05"/>
      {/* status dot on chip */}
      <circle cx="46" cy="68" r="3" fill="#3ddc97" opacity=".8"/>
      <circle cx="46" cy="68" r="6" fill="#3ddc97" fillOpacity=".1"/>
      {/* connection dashes to gateway */}
      <line x1="82" y1="52" x2="106" y2="52"
            stroke="rgba(61,220,151,.25)" strokeWidth="1.2" strokeDasharray="3,2"/>
      {/* in-flight packet */}
      <circle cx="96" cy="52" r="2.5" fill="#3ddc97" opacity=".55"/>
      {/* gateway outer rings */}
      <circle cx="136" cy="52" r="28" stroke="#3ddc97" strokeWidth=".5" opacity=".08"/>
      <circle cx="136" cy="52" r="20" stroke="#3ddc97" strokeWidth=".7" opacity=".13"/>
      <circle cx="136" cy="52" r="13" fill="rgba(61,220,151,.08)" stroke="rgba(61,220,151,.25)" strokeWidth="1.2"/>
      <circle cx="136" cy="52" r="6"  fill="rgba(61,220,151,.2)"  stroke="rgba(61,220,151,.45)" strokeWidth="1.2"/>
      <circle cx="136" cy="52" r="2.5" fill="#3ddc97" opacity=".9"/>
      {/* "ONLINE" badge */}
      <rect x="108" y="22" width="36" height="13" rx="4"
            fill="rgba(61,220,151,.12)" stroke="rgba(61,220,151,.3)" strokeWidth=".8"/>
      <circle cx="116" cy="28.5" r="2" fill="#3ddc97" opacity=".8"/>
      <rect x="120" y="26" width="20" height="2.5" rx="1.25" fill="rgba(61,220,151,.5)"/>
    </svg>
  );
}

const WAVE_BADGE: React.CSSProperties = {
  display: "inline-block",
  background: "rgba(255,255,255,.022)",
  color: "rgba(255,255,255,.65)",
  fontWeight: 900,
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
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

function NoEnginesState({ hasLicense }: { hasLicense: boolean }) {
  const steps = [
    {
      Illustration: GetKeyIllustration,
      done: hasLicense,
      badge: "Step 1",
      name: "Get an activation key",
      desc: hasLicense
        ? "License detected. Head to Licenses & Keys to issue your AQ Agent activation key if you haven't already."
        : "Subscribe on Billing to receive a license, then visit Licenses & Keys to issue your activation key. The raw key is shown once - copy it immediately.",
      features: ["Subscribe on the Billing page", "License provisioned automatically", "Issue key from Licenses & Keys", "Raw key shown once only"],
      cta: { label: hasLicense ? "View Licenses & Keys →" : "Go to Licenses & Keys →", href: "/app/licenses", active: true },
    },
    {
      Illustration: InstallIllustration,
      done: false,
      badge: "Step 2",
      name: "Install AQ Agent",
      desc: "Download the AQ Agent installer. Run it on any Windows PC or VPS - the setup wizard handles everything.",
      features: ["Windows 10 / 11 or Server", "Runs on any VPS provider", "MT5 must be installed", "One AQ Agent per device slot"],
      cta: { label: "Download from Licenses & Keys →", href: "/app/licenses", active: true },
    },
    {
      Illustration: HeartbeatIllustration,
      done: false,
      badge: "Step 3",
      name: "Connect & go online",
      desc: "Paste the key into AQ Agent's config.yaml under gateway.activation_key. AQ Agent connects, registers here, and starts sending heartbeats.",
      features: ["Paste key into config.yaml", "AQ Agent auto-registers on first run", "Heartbeat every 30 seconds", "Status updates in real time"],
      cta: { label: "AQ Agents appear here when connected", href: null, active: false },
    },
  ];

  const doneBadge: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    background: "rgba(61,220,151,.12)",
    color: "#3ddc97",
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    padding: "5px 12px",
    borderRadius: 999,
    border: "1px solid rgba(61,220,151,.3)",
  };

  return (
    <div className="flex justify-center mt-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-4xl">
        {steps.map(({ Illustration, done, badge, name, desc, features, cta }) => (
          <div key={name}
               className="panel flex flex-col overflow-hidden"
               style={{ border: "none", opacity: done ? 0.55 : 1, transition: "opacity .2s" }}>
            <div className="px-4 pt-4 pb-1"><Illustration /></div>
            <div className="px-5 pt-2 pb-4">
              <div className="text-sm font-semibold mb-0.5">{name}</div>
              <div className="text-[11px] muted leading-snug">{desc}</div>
              <div className="mt-3">
                {done ? (
                  <span style={doneBadge}>
                    <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5">
                      <path d="M2 6 L5 9 L10 3" stroke="#3ddc97" strokeWidth="1.6"
                            strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Done
                  </span>
                ) : (
                  <div style={WAVE_BADGE}>{badge}</div>
                )}
              </div>
            </div>
            <div className="px-5 pt-1 pb-5 flex flex-col flex-1">
              <ul className="mb-5 flex flex-col gap-1.5" style={{ minHeight: 88 }}>
                {features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-[11px] muted">
                    <span className="w-1 h-1 rounded-full shrink-0"
                          style={{ background: done ? "var(--success)" : "var(--success)", opacity: done ? 0.4 : 0.7 }} />
                    {f}
                  </li>
                ))}
              </ul>
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

/* ── page ─────────────────────────────────────────────────────────────── */
export default function Engines() {
  const supabase = getBrowserSupabase();
  const { session: authSession } = useAuth();
  const [engines, setEngines]     = useState<EngineView[]>([]);
  const [hasLicense, setHasLicense] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [nowMs, setNowMs]         = useState(0);
  const [confirmRelease, setConfirmRelease] = useState<string | null>(null);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }
    const devicesResult = await supabase
      .from("engine_devices")
      .select("id,license_id,engine_id,device_name,platform,engine_version,status,activated_at,last_seen_at,revoked_at")
      .in("status", ["active", "revoked"])
      .order("activated_at", { ascending: false });
    if (devicesResult.error) {
      setError(devicesResult.error.message);
      setLoading(false);
      return;
    }
    const devices   = (devicesResult.data ?? []) as EngineDevice[];
    const licIds    = [...new Set(devices.map(d => d.license_id))];
    const deviceIds = devices.map(d => d.id);

    const [licResult, entResult, sessResult, anyLicResult] = await Promise.all([
      licIds.length
        ? supabase.from("licenses").select("id,status,max_devices,expires_at").in("id", licIds)
        : Promise.resolve({ data: [], error: null }),
      licIds.length
        ? supabase.from("license_symbol_entitlements").select("license_id,symbol").in("license_id", licIds)
        : Promise.resolve({ data: [], error: null }),
      deviceIds.length
        ? supabase
            .from("engine_sessions")
            .select("engine_device_id,connected_at,disconnected_at,disconnect_reason,last_heartbeat_at,metadata")
            .in("engine_device_id", deviceIds)
            .order("connected_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      // Direct license check - needed when no devices are registered yet
      supabase.from("licenses").select("id").limit(1),
    ]);

    const err = licResult.error ?? entResult.error ?? sessResult.error;
    if (err) { setError(err.message); setLoading(false); return; }

    const licenses = new Map((licResult.data as License[]).map(l => [l.id, l]));
    const symbolsByLicense = new Map<string, string[]>();
    for (const item of entResult.data as { license_id: string; symbol: string }[]) {
      symbolsByLicense.set(item.license_id, [...(symbolsByLicense.get(item.license_id) ?? []), item.symbol]);
    }
    const sessions = new Map<string, EngineSession>();
    for (const s of sessResult.data as EngineSession[]) {
      if (!sessions.has(s.engine_device_id)) sessions.set(s.engine_device_id, s);
    }
    const slotsByLicense = new Map<string, number>();
    for (const d of devices) {
      if (d.status === "active") {
        slotsByLicense.set(d.license_id, (slotsByLicense.get(d.license_id) ?? 0) + 1);
      }
    }

    setHasLicense((anyLicResult.data?.length ?? 0) > 0);
    setEngines(devices.map(d => {
      const latestSession = sessions.get(d.id);
      return {
        ...d,
        license:    licenses.get(d.license_id),
        symbols:    symbolsByLicense.get(d.license_id) ?? [],
        session:    latestSession,
        usedSlots:  slotsByLicense.get(d.license_id) ?? 0,
        account:    mt5Account(d.platform, latestSession),
      };
    }));
    setError(null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const init  = setTimeout(() => void load(), 0);
    const poll  = setInterval(() => void load(), 30_000);
    const clockInit = setTimeout(() => setNowMs(Date.now()), 0);
    const clock = setInterval(() => setNowMs(Date.now()), 10_000);
    return () => {
      clearTimeout(init);
      clearTimeout(clockInit);
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [load]);

  async function releaseDevice(engine: EngineView) {
    if (!authSession?.access_token) {
      setActionError("Your session expired. Sign in again before releasing an agent.");
      return;
    }
    setActionError(null);
    setReleasing(engine.id);
    try {
      const response = await fetch(
        `${gatewayHttpBase()}/licenses/${engine.license_id}/devices/${engine.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${authSession.access_token}` },
        },
      );
      if (!response.ok && response.status !== 204) {
        const body = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? `Release failed with HTTP ${response.status}`);
      }
      setConfirmRelease(null);
      await load();
    } catch (releaseError) {
      setActionError(
        releaseError instanceof Error ? releaseError.message : "Trading Agent release failed.",
      );
    } finally {
      setReleasing(null);
    }
  }

  return (
    <div className="page-wrap space-y-4">
      <PageHeader
        eyebrow="AQ Agents"
        title="AQ Agents"
        description="Registered Trading Agents consuming license slots. Online = heartbeat within 90 s. Releasing an agent revokes its cloud identity and frees one registered slot."
        right={
          <>
            <a href="/app/licenses" className="btn btn-sm">View License Keys</a>
            <a href="/app/downloads" className="btn btn-sm btn-primary">Download Agent</a>
          </>
        }
      />

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="panel overflow-hidden">
              <div className="panel-head">
                <div><div className="skeleton h-4 w-48 mb-2" /><div className="skeleton h-2.5 w-32" /></div>
                <div className="skeleton h-5 w-20 rounded-full" />
              </div>
              <div className="panel-body grid grid-cols-4 gap-5">
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
        <div className="panel mt-4 p-4 border-[#f43f5e]/30 bg-[#f43f5e]/05">
          <div className="flex items-center gap-2 text-[#f43f5e] text-sm font-semibold">
            <ErrorIcon size={14} /> {error}
          </div>
        </div>
      )}
      {actionError && (
        <div className="alert tone-danger text-sm">
          <div className="font-semibold">Agent action failed</div>
          <div className="mt-1">{actionError}</div>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && engines.filter(e => e.status === "active").length === 0 && <NoEnginesState hasLicense={hasLicense} />}

      {/* Active engine cards */}
      <div className="space-y-3">
        {engines.filter(e => e.status === "active").map(engine => {
          const state  = engineState(engine, nowMs);
          const maxDev = engine.license?.max_devices ?? 0;
          const licExp = engine.license?.expires_at;

          return (
            <section key={engine.id} className="panel overflow-hidden">
              {/* Card header */}
              <div className="panel-head flex-col sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">
                    {engine.device_name || engine.engine_id}
                  </div>
                  <div className="text-xs muted mt-0.5 mono truncate">
                    {engine.engine_id.slice(0, 18)}{engine.engine_id.length > 18 ? "…" : ""} · {platformLabel(engine.platform)}
                  </div>
                </div>
                <StateLabel state={state} />
              </div>

              {/* Metrics row */}
              <div className="panel-body grid grid-cols-2 sm:grid-cols-5 gap-5">
                <div>
                  <div className="muted text-xs">Version</div>
                  <div className="mt-2 mono text-xs font-medium">{engine.engine_version || "-"}</div>
                </div>
                <div>
                  <div className="muted text-xs">Symbols</div>
                  <div className="mt-2 mono text-xs font-medium break-words">
                    {engine.symbols.length > 0 ? engine.symbols.join(", ") : "None"}
                  </div>
                </div>
                <div>
                  <div className="muted text-xs">Registered slots</div>
                  <div className="mt-2 mono text-xs font-medium">
                    {engine.usedSlots} of {maxDev || "-"}
                  </div>
                </div>
                <div>
                  <div className="muted text-xs">MT5 account</div>
                  <div className="mt-2 mono text-xs font-medium">
                    {engine.account
                      ? `${engine.account.server} / ${engine.account.login}`
                      : "Not reported"}
                  </div>
                  {engine.account?.mode && (
                    <div className="mt-1 text-[10px] muted uppercase">{engine.account.mode}</div>
                  )}
                </div>
                <div>
                  <div className="muted text-xs">Last heartbeat</div>
                  <div className="mt-2 mono text-xs font-medium">
                    {timeAgo(engine.session?.last_heartbeat_at ?? engine.last_seen_at, nowMs)}
                  </div>
                </div>
              </div>

              {/* License badge row */}
              <div className="px-5 pb-4 flex flex-wrap items-center gap-2">
                <span className={`badge ${engine.license?.status === "active" ? "badge-green" : engine.license ? "badge-warn" : "badge-muted"}`}>
                  License: {engine.license?.status ?? "unknown"}
                </span>
                {licExp && (
                  <span className="badge badge-muted">
                    Expires {new Date(licExp).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </span>
                )}
                {state === "degraded" && <span className="badge badge-warn">Heartbeat delayed</span>}
                <button
                  type="button"
                  className="btn btn-sm btn-danger ml-auto"
                  onClick={() => setConfirmRelease(engine.id)}
                  disabled={releasing === engine.id}
                >
                  Release Trading Agent
                </button>
              </div>

              {confirmRelease === engine.id && (
                <div className="mx-5 mb-4 p-4 rounded border border-[#f43f5e]/30 bg-[#f43f5e]/05">
                  <div className="text-sm font-semibold text-[#f43f5e]">
                    Release this registered Trading Agent?
                  </div>
                  <div className="text-xs muted mt-1">
                    This revokes its cloud device credential, disconnects it from the Gateway,
                    and frees one license slot. It does not close broker positions or delete
                    local agent data. Stop the local agent first; a running agent may activate
                    again and reclaim the slot.
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      className="btn btn-sm btn-danger-solid"
                      disabled={releasing === engine.id}
                      onClick={() => void releaseDevice(engine)}
                    >
                      {releasing === engine.id ? "Releasing..." : "Confirm Release"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={releasing === engine.id}
                      onClick={() => setConfirmRelease(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Disconnect reason */}
              {state === "offline" && engine.session?.disconnect_reason && (
                <div className="px-5 pb-4 text-xs muted border-t border-white/[.05] pt-3">
                  Last disconnect: {engine.session.disconnect_reason}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Released devices — history, no actions */}
      {!loading && engines.some(e => e.status === "revoked") && (
        <div className="space-y-2">
          <div className="text-xs muted uppercase tracking-wider px-1">Released devices</div>
          {engines.filter(e => e.status === "revoked").map(engine => (
            <section key={engine.id} className="panel overflow-hidden opacity-60">
              <div className="panel-head flex-col sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">
                    {engine.device_name || engine.engine_id}
                  </div>
                  <div className="text-xs muted mt-0.5 mono truncate">
                    {engine.engine_id.slice(0, 18)}{engine.engine_id.length > 18 ? "…" : ""} · {platformLabel(engine.platform)}
                  </div>
                </div>
                <span className="badge badge-muted">released</span>
              </div>
              <div className="panel-body grid grid-cols-2 sm:grid-cols-4 gap-5 text-xs">
                <div>
                  <div className="muted text-xs">Version</div>
                  <div className="mt-2 mono font-medium">{engine.engine_version || "-"}</div>
                </div>
                <div>
                  <div className="muted text-xs">Activated</div>
                  <div className="mt-2 mono font-medium">
                    {new Date(engine.activated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </div>
                <div>
                  <div className="muted text-xs">Released</div>
                  <div className="mt-2 mono font-medium">
                    {engine.revoked_at
                      ? new Date(engine.revoked_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "-"}
                  </div>
                </div>
                <div>
                  <div className="muted text-xs">Symbols</div>
                  <div className="mt-2 mono font-medium break-words">
                    {engine.symbols.length > 0 ? engine.symbols.join(", ") : "None"}
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
