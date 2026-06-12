import Link from "next/link";
import type { Metadata } from "next";
import {
  PublicShell,
  Container,
  Section,
  SectionLabel,
  T,
  DOWNLOAD_URL,
  SITE_URL,
} from "@/components/public/shell";
import { ManualVsControlledDiagram } from "@/components/public/diagrams";

export const metadata: Metadata = {
  title: "Apex Quantel | Automated MT5 Execution Infrastructure",
  description:
    "Apex Quantel routes private trading signals to a local Windows agent for MetaTrader 5 execution, risk checks, position sizing, and live monitoring.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Apex Quantel | Automated MT5 Execution Infrastructure",
    description:
      "Apex Quantel routes private trading signals to a local Windows agent for MetaTrader 5 execution, risk checks, position sizing, and live monitoring.",
    url: SITE_URL,
    siteName: "Apex Quantel",
    images: [
      {
        url: `${SITE_URL}/apex-quantel-og.png`,
        width: 1200,
        height: 630,
        alt: "Apex Quantel — Automated MT5 Execution Infrastructure",
        type: "image/png",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Apex Quantel | Automated MT5 Execution Infrastructure",
    description:
      "Apex Quantel routes private trading signals to a local Windows agent for MetaTrader 5 execution, risk checks, position sizing, and live monitoring.",
    images: [`${SITE_URL}/apex-quantel-og.png`],
  },
};

// ── Local components ─────────────────────────────────────────────────────────

const HERO_STEPS = [
  { label: "Signal arrives", desc: "Dispatched to licensed accounts only" },
  { label: "Access verified", desc: "Gateway confirms active licence" },
  { label: "Risk reviewed", desc: "Account limits checked before entry" },
  { label: "Order placed", desc: "Executed through your local MT5", accent: true },
  { label: "Position managed", desc: "Tracked from entry to close" },
];

function HeroSteps() {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {HERO_STEPS.map(({ label, desc, accent }, i) => (
        <div key={label} style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 32 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: accent ? "var(--success-bg)" : "var(--surface-2)",
                border: `1px solid ${accent ? "var(--success-border)" : "var(--line)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".04em",
                color: accent ? "var(--success)" : "var(--muted)",
                flexShrink: 0,
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </div>
            {i < HERO_STEPS.length - 1 && (
              <div style={{ width: 1, height: 28, background: "var(--line-soft)" }} />
            )}
          </div>
          <div style={{ paddingBottom: i < HERO_STEPS.length - 1 ? 0 : 0, paddingTop: 6 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: accent ? "var(--text)" : "var(--text-soft)",
                marginBottom: 3,
                letterSpacing: "-.01em",
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: "var(--muted)",
                lineHeight: 1.5,
                paddingBottom: i < HERO_STEPS.length - 1 ? 20 : 0,
              }}
            >
              {desc}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function InfoRow({
  n,
  title,
  body,
  last = false,
}: {
  n: string;
  title: string;
  body: string;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "52px 1fr",
        gap: "0 24px",
        padding: "22px 0",
        borderBottom: last ? "none" : "1px solid var(--line-soft)",
      }}
    >
      <div style={{ ...T.mono, paddingTop: 2 }}>{n}</div>
      <div>
        <h3 style={T.h3}>{title}</h3>
        <p style={T.body}>{body}</p>
      </div>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <div style={{ ...T.mono, ...T.label, display: "block", marginBottom: 14 }}>{n}</div>
      <h3 style={{ ...T.h3, fontSize: 15 }}>{title}</h3>
      <p style={T.body}>{body}</p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <PublicShell>
      <main>
        {/* Hero */}
        <section className="public-hero" style={{ padding: "88px 0 80px" }}>
          <Container>
            <div className="public-hero-grid">
              <div className="public-hero-copy">
                <SectionLabel text="Private signal execution" />
                <h1 style={T.h1}>
                  Controlled execution.<br />
                  <strong>From signal to MT5.</strong>
                </h1>
                <p style={{ ...T.body, fontSize: 15, maxWidth: 520, marginBottom: 36 }}>
                  Apex Quantel receives approved trading signals and executes them through a local
                  Windows agent connected to your MetaTrader 5 account — automatically and consistently.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 40 }}>
                  <Link
                    href="/login"
                    className="public-primary-button"
                    style={{
                      fontWeight: 700,
                      fontSize: 13.5,
                      padding: "8px 38px",
                      borderRadius: 8,
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    Access dashboard
                  </Link>
                  <a
                    href={DOWNLOAD_URL}
                    download="AQAgentSetup.exe"
                    style={{
                      background: "rgba(255,255,255,.04)",
                      color: "var(--text-soft)",
                      fontWeight: 600,
                      fontSize: 13.5,
                      padding: "8px 32px",
                      borderRadius: 8,
                      border: "1px solid var(--line-strong)",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    Download AQ Agent
                  </a>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
                  {["Private routing", "Local credentials", "Pre-trade risk", "Full event log"].map((item) => (
                    <span key={item} style={{ fontSize: 12, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--line-strong)", display: "inline-block" }} />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="public-hero-visual">
                <HeroSteps />
              </div>
            </div>
          </Container>
        </section>

        {/* Feature strip */}
        <Section noBorderTop py={32}>
          <Container>
            <div className="public-stat-grid">
              {[
                ["Local authority", "Orders execute through your connected MT5 terminal — not a cloud server."],
                ["Pre-trade control", "Account, exposure, and drawdown limits enforced before every order."],
                ["Managed lifecycle", "Position sizing, partial close, and stop management handled automatically."],
                ["Auditable events", "Every signal, rejection, and trade action recorded in the dashboard."],
              ].map(([value, label]) => (
                <div className="public-stat" key={value}>
                  <span className="public-stat-value">{value}</span>
                  <span className="public-stat-label">{label}</span>
                </div>
              ))}
            </div>
          </Container>
        </Section>

        {/* What it does */}
        <Section>
          <Container>
            <SectionLabel text="What Apex Quantel does" />
            <h2 style={T.h2}>Signal to execution, fully managed.</h2>
            <p style={{ ...T.body, marginBottom: 36 }}>
              Four stages cover the complete trade lifecycle — from the moment a signal arrives to the
              final close.
            </p>
            <div className="public-content-card">
              <InfoRow
                n="01"
                title="Signal routing"
                body="Private signals are verified and forwarded to licensed accounts only. Each signal carries the entry level, stop loss, take-profit targets, symbol, and direction."
              />
              <InfoRow
                n="02"
                title="Local execution"
                body="The AQ Agent runs on your Windows machine and places orders through MetaTrader 5 directly. Nothing routes through a cloud execution server."
              />
              <InfoRow
                n="03"
                title="Risk enforcement"
                body="Before placing any order, the engine verifies your account balance, open exposure, daily loss limits, and position size constraints."
              />
              <InfoRow
                n="04"
                title="Trade management"
                body="Once a position is open, the engine moves the stop to breakeven, closes a partial at the first target, and tracks the trade through to final close."
                last
              />
            </div>
          </Container>
        </Section>

        {/* Why it exists */}
        <Section>
          <Container>
            <div className="grid md:grid-cols-2 gap-12 items-start public-content-card">
              <div>
                <SectionLabel text="Why it exists" />
                <h2 style={T.h2}>Built to remove manual execution errors.</h2>
                <p style={T.body}>
                  A signal identifies the trade. It does not place the order, size the position,
                  move the stop to breakeven, or close the partial. That gap is where execution
                  breaks down.
                </p>
              </div>
              <div>
                <p style={{ ...T.body, marginBottom: 20 }}>
                  Manual execution introduces the same failures on every active session. They are
                  not exceptional — they are predictable and compounding.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    "Entries missed while away from the desk",
                    "Position sizes calculated incorrectly under pressure",
                    "Breakeven moves delayed or skipped entirely",
                    "Take-profit targets adjusted after entry",
                  ].map((point) => (
                    <div key={point} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span style={{ fontSize: 13, color: "var(--line-strong)", marginTop: 4, flexShrink: 0, lineHeight: 1 }}>—</span>
                      <span style={{ ...T.body, fontSize: 13.5 }}>{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 40 }}>
              <ManualVsControlledDiagram />
            </div>
          </Container>
        </Section>

        {/* Getting started */}
        <Section surface>
          <Container>
            <SectionLabel text="Getting started" />
            <h2 style={{ ...T.h2, marginBottom: 44 }}>Three steps to live execution.</h2>
            <div className="grid sm:grid-cols-3 gap-10">
              <Step
                n="01"
                title="Activate licence"
                body="Sign in to the dashboard, choose a plan, and generate your licence key. The key links your account to your agent installation."
              />
              <Step
                n="02"
                title="Install AQ Agent"
                body="Download the Windows installer and run it on the same machine as MetaTrader 5. The agent connects to your broker terminal on startup."
              />
              <Step
                n="03"
                title="Connect and monitor"
                body="Enter your MT5 credentials in the agent. Once connected, the dashboard shows live execution state, open positions, and account metrics."
              />
            </div>
          </Container>
        </Section>

        {/* What stays local */}
        <Section>
          <Container>
            <SectionLabel text="Execution and control" />
            <h2 style={T.h2}>Execution stays on your machine.</h2>
            <p style={{ ...T.body, maxWidth: 580, marginBottom: 36 }}>
              Your MT5 credentials are entered into the agent on your own machine and are never
              transmitted to external servers. The dashboard manages access and monitoring only.
            </p>
            <div
              className="grid sm:grid-cols-2"
              style={{ gap: 1, background: "var(--line-soft)", border: "1px solid var(--line-soft)", borderRadius: 10, overflow: "hidden" }}
            >
              {(
                [
                  ["Local execution", "Trade orders are placed from your Windows machine through the locally connected MT5 terminal."],
                  ["Credential handling", "MT5 login details are stored in the agent configuration file on your machine — not on our servers."],
                  ["Dashboard scope", "The dashboard handles licence activation, billing, and execution monitoring only."],
                  ["Risk enforcement", "Drawdown limits, lot size caps, and daily loss budgets are applied before any order is placed."],
                  ["Licence binding", "Each installation is linked to your dashboard account via a unique licence key."],
                  ["Trading risk", "Automation does not remove market risk. You remain responsible for your account and the signals you execute."],
                ] as [string, string][]
              ).map(([title, body]) => (
                <div key={title} style={{ padding: "18px 22px", background: "var(--surface-1)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-soft)", marginBottom: 5 }}>{title}</div>
                  <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>{body}</div>
                </div>
              ))}
            </div>
          </Container>
        </Section>

        {/* CTA */}
        <Section surface>
          <Container narrow>
            <div style={{ textAlign: "center" }}>
              <h2
                style={{
                  fontSize: "clamp(22px, 3.5vw, 32px)",
                  fontWeight: 800,
                  letterSpacing: "-.03em",
                  margin: "0 0 13px",
                  color: "var(--text)",
                }}
              >
                Start with the agent.
              </h2>
              <p style={{ ...T.body, fontSize: 14, marginBottom: 30 }}>
                Download the AQ Agent, sign in to activate your licence, and connect to MetaTrader 5.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <Link
                  href="/login"
                  style={{
                    background: "var(--success)",
                    color: "#03120c",
                    border: "0",
                    fontWeight: 700,
                    fontSize: 13.5,
                    padding: "8px 38px",
                    borderRadius: 8,
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  Sign in
                </Link>
                <a
                  href={DOWNLOAD_URL}
                  download="AQAgentSetup.exe"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--text-soft)",
                    fontWeight: 600,
                    fontSize: 13.5,
                    padding: "8px 32px",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  Download AQ Agent
                </a>
              </div>
            </div>
          </Container>
        </Section>
      </main>
    </PublicShell>
  );
}
