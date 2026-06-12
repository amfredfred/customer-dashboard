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
        <section style={{ padding: "84px 0 72px" }}>
          <Container>
            <h1 style={T.h1}>
              Automated MT5 execution<br />
              for private trading signals.
            </h1>
            <p style={{ ...T.body, fontSize: 15, maxWidth: 600, marginBottom: 34 }}>
              Apex Quantel routes approved trading signals to a local Windows agent that executes
              on MetaTrader 5 with risk checks, position sizing, breakeven handling, and live
              monitoring.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 48 }}>
              <Link
                href="/login"
                style={{
                  background: "var(--success)",
                  color: "#03120c",
                  fontWeight: 700,
                  fontSize: 13.5,
                  padding: "11px 26px",
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
                  padding: "11px 22px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                Download AQ Agent
              </a>
            </div>
            <div
              style={{
                paddingTop: 24,
                borderTop: "1px solid var(--line-soft)",
                display: "flex",
                flexWrap: "wrap",
                columnGap: 0,
                rowGap: 10,
              }}
            >
              {[
                "Local Windows agent",
                "MetaTrader 5 execution",
                "Risk checks before entry",
                "Live dashboard monitoring",
              ].map((item, i, arr) => (
                <span
                  key={item}
                  style={{
                    fontSize: 12,
                    color: "var(--muted)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    paddingRight: i < arr.length - 1 ? 20 : 0,
                    marginRight: i < arr.length - 1 ? 20 : 0,
                    borderRight:
                      i < arr.length - 1 ? "1px solid var(--line)" : "none",
                  }}
                >
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: "var(--line-strong)",
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  {item}
                </span>
              ))}
            </div>
          </Container>
        </section>

        {/* What it does */}
        <Section surface>
          <Container>
            <SectionLabel text="What Apex Quantel does" />
            <h2 style={T.h2}>Signal to execution, fully managed.</h2>
            <p style={{ ...T.body, marginBottom: 36 }}>
              Four components handle the complete lifecycle — from signal receipt to closed trade.
            </p>
            <div>
              <InfoRow
                n="01"
                title="Signal routing"
                body="Private signals are validated and routed through the gateway to licensed accounts only. Each signal carries entry price, stop loss, take-profit levels, symbol, and direction."
              />
              <InfoRow
                n="02"
                title="Local execution"
                body="The AQ Agent runs on the user's Windows machine and communicates with MetaTrader 5 directly. Orders are placed from the same machine as the MT5 terminal — no cloud intermediary."
              />
              <InfoRow
                n="03"
                title="Risk enforcement"
                body="Before placing any order, the engine checks account equity, symbol exposure, daily loss budget, lot size limits, drawdown thresholds, and broker stop-level requirements."
              />
              <InfoRow
                n="04"
                title="Trade management"
                body="The engine monitors open positions and handles breakeven stop moves, partial take-profit closes at configurable trigger levels, and tracks full position state through to close."
                last
              />
            </div>
          </Container>
        </Section>

        {/* Why it exists */}
        <Section>
          <Container>
            <div className="grid md:grid-cols-2 gap-12 items-start">
              <div>
                <SectionLabel text="Why it exists" />
                <h2 style={T.h2}>Built to remove manual execution errors.</h2>
                <p style={T.body}>
                  Signal alerts identify the trade. They do not place the order, size the position
                  correctly, move the stop to breakeven, or close the partial. That gap is where
                  execution breaks down.
                </p>
              </div>
              <div>
                <p style={{ ...T.body, marginBottom: 20 }}>
                  Manual execution introduces consistent failures that compound over time. These are
                  not exceptional scenarios — they happen on every active trading session.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    "Entries missed while away from the desk",
                    "Lot sizes calculated incorrectly under pressure",
                    "Breakeven moves delayed or skipped entirely",
                    "Take-profit targets adjusted after entry",
                  ].map((point) => (
                    <div key={point} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span
                        style={{
                          fontSize: 13,
                          color: "var(--line-strong)",
                          marginTop: 4,
                          flexShrink: 0,
                          lineHeight: 1,
                        }}
                      >
                        —
                      </span>
                      <span style={{ ...T.body, fontSize: 13.5 }}>{point}</span>
                    </div>
                  ))}
                </div>
              </div>
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
                body="Sign in to the dashboard, choose a plan, and generate your licence key. The key binds your account to the AQ Agent installation."
              />
              <Step
                n="02"
                title="Install AQ Agent"
                body="Download the Windows installer and run it on the same machine as MetaTrader 5. The agent connects to your broker terminal on startup."
              />
              <Step
                n="03"
                title="Connect MT5 and monitor"
                body="Enter your MT5 broker credentials in the agent. Once connected, the dashboard shows live execution state, open positions, and account risk metrics."
              />
            </div>
          </Container>
        </Section>

        {/* Execution stays local */}
        <Section>
          <Container>
            <SectionLabel text="Execution and control" />
            <h2 style={T.h2}>Execution stays on your machine.</h2>
            <p style={{ ...T.body, maxWidth: 580, marginBottom: 36 }}>
              The AQ Agent operates locally. The dashboard manages access, licences, and monitoring.
              MT5 credentials are entered into the agent on your machine and are not transmitted to
              external servers.
            </p>
            <div
              className="grid sm:grid-cols-2"
              style={{ gap: 1, background: "var(--line-soft)", border: "1px solid var(--line-soft)", borderRadius: 10, overflow: "hidden" }}
            >
              {(
                [
                  ["Local agent", "Trade execution runs on the user's Windows machine, not on a cloud server."],
                  ["Credential handling", "MT5 login credentials are stored locally in the agent configuration file."],
                  ["Dashboard scope", "The dashboard manages licence keys, billing, and execution monitoring only."],
                  ["Risk enforcement", "Drawdown limits, lot size caps, and daily loss budgets are applied before any order is placed."],
                  ["Licence binding", "Each installation requires an active licence key linked to the dashboard account."],
                  ["Trading risk", "Automation does not eliminate market risk. Users remain responsible for their account and the signals being executed."],
                ] as [string, string][]
              ).map(([title, body]) => (
                <div key={title} style={{ padding: "18px 22px", background: "var(--surface-1)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-soft)", marginBottom: 5 }}>
                    {title}
                  </div>
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
                    fontWeight: 700,
                    fontSize: 13.5,
                    padding: "12px 28px",
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
                    padding: "12px 22px",
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
