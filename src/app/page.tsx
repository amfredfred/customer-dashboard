import {
  ArrowRight, CheckCircle, ChevronDown, KeyRound,
  RadioTower, Shield, ShieldCheck, TerminalSquare, Zap,
} from "lucide-react";
import Link from "next/link";

/* ─────────────────────────── data ──────────────────────────────────── */
const ARCH_STEPS = [
  {
    Icon: RadioTower,
    title: "Private Signal Engine",
    detail:
      "Runs in our secure infrastructure. Scans markets, emits structured signals, and broadcasts to licensed subscribers only.",
    domain: "signal.metrics",
    accent: "#3ddc97",
  },
  {
    Icon: Shield,
    title: "Execution Gateway",
    detail:
      "Authenticates customers, enforces licenses, routes signals to entitled engines, and records telemetry.",
    domain: "gateway.auth",
    accent: "#8ab4ff",
  },
  {
    Icon: TerminalSquare,
    title: "Your Execution Engine",
    detail:
      "Installed beside your MetaTrader 5. Applies private risk controls before any order is sent to your broker.",
    domain: "execution.metrics",
    accent: "#f5b942",
  },
] as const;

const FEATURES = [
  {
    title: "Licensed access",
    detail: "Every Execution Engine is gated behind a license. Activation keys are issued server-side and never generated in the browser.",
    color: "#3ddc97",
  },
  {
    title: "Strict metric separation",
    detail: "Signal Engine metrics are sanitised and global. Execution Engine metrics are private and owner-scoped — never mixed.",
    color: "#8ab4ff",
  },
  {
    title: "Local risk authority",
    detail: "Your engine applies daily budget limits, drawdown caps, and slippage guards before any position is opened.",
    color: "#f5b942",
  },
  {
    title: "Real-time dashboard",
    detail: "Monitor scanner health, signal funnels, account state, and engine heartbeats from one secure control plane.",
    color: "#3ddc97",
  },
  {
    title: "Activation key management",
    detail: "Issue, revoke, or rotate keys from the dashboard. Raw keys are shown once and never stored in plain text.",
    color: "#8ab4ff",
  },
  {
    title: "Demand-driven streams",
    detail: "WebSocket subscriptions activate only when a page is open. No unnecessary upstream load when the dashboard is closed.",
    color: "#f5b942",
  },
] as const;

const PLANS = [
  {
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

const FAQS = [
  {
    q: "What is the Execution Engine?",
    a: "A Python application you install on a Windows VPS beside MetaTrader 5. It connects to the TradeRelay Gateway using your activation key, receives licensed signals, and applies your private risk controls before opening any trades.",
  },
  {
    q: "Can TradeRelay access my broker account?",
    a: "No. The Execution Engine runs locally on your machine. TradeRelay's Gateway routes signals and records telemetry — it never has credentials to your MT5 account or broker.",
  },
  {
    q: "What is the difference between Signal and Execution metrics?",
    a: "Signal metrics are global and sanitised: scanner health, signal funnels, strategy performance. Execution metrics are private and owner-scoped: your balance, trades, risk state, and order activity. They are always kept on separate streams.",
  },
  {
    q: "Where are activation keys stored?",
    a: "Keys are generated server-side. The raw key is shown to you once immediately after issuance. After that, only a cryptographic hash is retained. If you lose the key, you issue a replacement — not a retrieval.",
  },
] as const;

/* ─────────────────────────── components ────────────────────────────── */
function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="border-b border-white/[.07] last:border-0 group">
      <summary className="flex items-center justify-between gap-4 py-5 cursor-pointer list-none text-sm font-medium select-none">
        {q}
        <ChevronDown size={14} className="muted shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <p className="pb-5 text-sm muted leading-7">{a}</p>
    </details>
  );
}

/* ─────────────────────────── page ──────────────────────────────────── */
export default function Home() {
  return (
    <main>
      {/* Header */}
      <header className="h-16 max-w-7xl mx-auto px-5 flex items-center justify-between sticky top-0 z-20 bg-[#08090bcc] backdrop-blur-md border-b border-white/[.05]">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md border border-[#3ddc97]/40 bg-[#041c10] grid place-items-center mono text-[10px] font-bold text-[#3ddc97]">
            TR
          </div>
          <span className="font-bold tracking-[.18em] text-sm">TRADERELAY</span>
        </div>
        <nav className="flex items-center gap-5 text-sm">
          <a href="#architecture" className="muted hover:text-white transition-colors hidden sm:block">
            Architecture
          </a>
          <a href="#pricing" className="muted hover:text-white transition-colors hidden sm:block">
            Pricing
          </a>
          <Link href="/login" className="pill hover:border-white/20 transition-colors">
            Sign in <ArrowRight size={11} />
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-5 pt-24 pb-24">
        <div className="max-w-3xl">
          <span className="pill mb-6 inline-flex">
            <span className="dot dot-live pulse" />
            Private signal infrastructure
          </span>
          <h1 className="mt-5 text-5xl md:text-[64px] font-semibold tracking-[-.055em] leading-[1.0]">
            A customer control center<br className="hidden md:block" /> for signal infrastructure<br className="hidden md:block" /> and private execution.
          </h1>
          <p className="mt-7 text-lg muted max-w-2xl leading-8">
            Monitor your licensed Execution Engines, track private account metrics, manage activation keys, and view sanitised Signal Engine performance — all from one secure dashboard.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-[#3ddc97] text-black font-semibold rounded-xl px-6 py-3 text-sm hover:bg-[#45f0a5] transition-colors"
            >
              Get started <ArrowRight size={14} />
            </Link>
            <a
              href="#architecture"
              className="panel inline-flex items-center gap-2 px-6 py-3 text-sm hover:border-white/20 transition-colors"
            >
              How it works
            </a>
          </div>
        </div>

        {/* Architecture preview card */}
        <div className="mt-16 grid md:grid-cols-3 gap-3" id="architecture">
          {ARCH_STEPS.map(({ Icon, title, detail, domain, accent }, i) => (
            <div key={title} className="relative">
              <div
                className="panel p-5 h-full"
                style={{ borderColor: `${accent}22` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-9 h-9 rounded-xl grid place-items-center"
                    style={{ background: `${accent}14`, border: `1px solid ${accent}30` }}
                  >
                    <Icon size={16} style={{ color: accent }} />
                  </div>
                  <span className="pill mono text-[10px]">{domain}</span>
                </div>
                <div className="text-sm font-semibold mt-3">{title}</div>
                <p className="muted text-xs leading-5 mt-2">{detail}</p>
              </div>
              {i < ARCH_STEPS.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-2 z-10 w-4 h-px bg-white/20" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-5 pb-24">
        <div className="text-[10px] uppercase tracking-[.22em] muted">How it works</div>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight">
          Signals stay global. Execution stays private.
        </h2>
        <div className="mt-10 grid md:grid-cols-3 gap-8">
          {[
            {
              step: "01",
              title: "Connect your engine",
              detail: "Install the Execution Engine on a Windows VPS beside MetaTrader 5. Activate it with a key from the dashboard.",
            },
            {
              step: "02",
              title: "Receive licensed signals",
              detail: "The Gateway authenticates your session and routes private signals to your engine based on your license entitlements.",
            },
            {
              step: "03",
              title: "Local risk has final say",
              detail: "Your engine applies daily budget, drawdown limits, and slippage guards before any order reaches your broker.",
            },
          ].map(({ step, title, detail }) => (
            <div key={step} className="flex gap-4">
              <div className="text-[#3ddc97] font-bold mono text-sm shrink-0 mt-0.5">{step}</div>
              <div>
                <div className="font-semibold text-sm">{title}</div>
                <p className="muted text-sm leading-6 mt-2">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-5 pb-24">
        <div className="text-[10px] uppercase tracking-[.22em] muted">Platform</div>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight">Built for real trading infrastructure.</h2>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ title, detail, color }) => (
            <div key={title} className="panel p-5" style={{ borderTopColor: `${color}33`, borderTopWidth: 2 }}>
              <CheckCircle size={14} style={{ color }} className="mb-3" />
              <div className="font-semibold text-sm">{title}</div>
              <p className="muted text-xs leading-5 mt-2">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-7xl mx-auto px-5 pb-24" id="pricing">
        <div className="text-[10px] uppercase tracking-[.22em] muted">Pricing</div>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight">
          Start with one account. Scale deliberately.
        </h2>
        <div className="mt-10 grid md:grid-cols-3 gap-4">
          {PLANS.map(({ name, price, interval, desc, features, highlight }) => (
            <div
              key={name}
              className="panel p-6 flex flex-col"
              style={
                highlight
                  ? { borderColor: "rgba(61,220,151,.3)", background: "rgba(61,220,151,.04)" }
                  : undefined
              }
            >
              {highlight && (
                <div className="badge badge-green mb-4 w-fit">Most popular</div>
              )}
              <div className="text-sm font-semibold">{name}</div>
              <p className="muted text-xs mt-1 leading-5">{desc}</p>
              <div className="mt-5 text-4xl font-semibold tracking-tight">
                {price}
                <span className="text-base muted">{interval}</span>
              </div>
              <div className="mt-6 space-y-3 flex-1">
                {features.map(f => (
                  <div key={f} className="flex items-start gap-2 text-sm muted">
                    <ShieldCheck size={13} className="text-[#3ddc97] mt-0.5 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
              <Link
                href="/login"
                className={`mt-8 block text-center rounded-xl py-3 text-sm font-medium transition-colors ${
                  highlight
                    ? "bg-[#3ddc97] text-black font-semibold hover:bg-[#45f0a5]"
                    : "border border-white/10 hover:border-white/20"
                }`}
              >
                Choose {name}
              </Link>
            </div>
          ))}
        </div>
        <p className="muted text-xs mt-6">
          Checkout requires a verified payment-provider webhook before a license is issued.
          No trial is activated automatically.
        </p>
      </section>

      {/* Trust / FAQ */}
      <section className="max-w-7xl mx-auto px-5 pb-24">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          <div>
            <div className="text-[10px] uppercase tracking-[.22em] muted">Trust</div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">Designed to stay out of your money.</h2>
            <p className="muted mt-4 text-sm leading-7">
              TradeRelay routes signals and records telemetry. It never holds broker credentials,
              never initiates orders, and never accesses your account directly.
              All execution authority stays on your machine.
            </p>
            <div className="mt-8 space-y-4">
              {[
                [Zap, "Execution is always local"],
                [KeyRound, "Keys are issued server-side only"],
                [ShieldCheck, "Execution data is owner-scoped"],
                [RadioTower, "Signal data is sanitised before broadcast"],
              ].map(([Icon, text]) => (
                <div key={String(text)} className="flex items-center gap-3 text-sm">
                  <Icon size={14} className="text-[#3ddc97] shrink-0" />
                  <span className="muted">{String(text)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel p-6 divide-y-0">
            {FAQS.map(({ q, a }) => (
              <FaqItem key={q} q={q} a={a} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-5 pb-28">
        <div className="panel p-8 md:p-12 text-center bg-gradient-to-b from-[#3ddc97]/[.04] to-transparent" style={{ borderColor: "rgba(61,220,151,.15)" }}>
          <div className="pill inline-flex mx-auto mb-5">
            <span className="dot dot-live pulse" />
            Production ready
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Your signal infrastructure.<br />Your execution authority.
          </h2>
          <p className="muted mt-4 max-w-xl mx-auto text-sm leading-7">
            Sign in to access the customer dashboard, manage your licensed engines,
            monitor private execution metrics, and issue activation keys.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-[#3ddc97] text-black font-semibold rounded-xl px-7 py-3.5 text-sm hover:bg-[#45f0a5] transition-colors"
            >
              Sign in securely <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
