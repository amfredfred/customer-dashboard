import Link from "next/link";
import type { Metadata } from "next";
import {
  PublicShell,
  Container,
  Section,
  SectionLabel,
  PageHero,
  FAQItem,
  Callout,
  T,
  DOWNLOAD_URL,
  SITE_URL,
} from "@/components/public/shell";

export const metadata: Metadata = {
  title: "FAQ | Apex Quantel",
  description:
    "Answers to common questions about Apex Quantel, local MT5 execution, risk controls, licences, trading risk, and the Windows execution agent.",
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "FAQ | Apex Quantel",
    description: "Common questions about Apex Quantel — execution, risk, licences, and requirements.",
    url: `${SITE_URL}/faq`,
    siteName: "Apex Quantel",
    images: [{ url: `${SITE_URL}/apex-quantel-og.png`, width: 1200, height: 630, alt: "Apex Quantel FAQ", type: "image/png" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FAQ | Apex Quantel",
    description: "Common questions about Apex Quantel — execution, risk, licences, and requirements.",
    images: [`${SITE_URL}/apex-quantel-og.png`],
  },
};

function FAQGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 52 }}>
      <div style={{ marginBottom: 4 }}>
        <SectionLabel text={label} />
      </div>
      {children}
    </div>
  );
}

export default function FAQPage() {
  return (
    <PublicShell>
      <main>
        <PageHero
          label="FAQ"
          heading="Common questions."
          sub="Direct answers to questions about what Apex Quantel is, how it works, what it requires, and what it does not do."
        />

        <Section>
          <Container>
            <FAQGroup label="General">
              <FAQItem q="Is Apex Quantel a trading bot?">
                Apex Quantel is an execution system, not a trading bot. It does not decide what to
                trade. It receives approved trading signals from a private signal source and
                executes them through a local MT5 agent, subject to configured risk checks. The
                trading decisions originate from the signal source.
              </FAQItem>

              <FAQItem q="Does Apex Quantel guarantee profit?">
                No. Trading financial instruments carries risk, and the platform does not change
                that. Apex Quantel enforces execution rules and risk limits, but it cannot control
                market conditions, signal accuracy, slippage, or trade outcomes. Users may lose
                capital.
              </FAQItem>

              <FAQItem q="Is this suitable for beginners?">
                Apex Quantel is designed for users who already understand trading risk, have a
                MetaTrader 5 account with a broker, and have access to the approved signal source.
                It is execution infrastructure, not a trading education tool. Users who do not
                understand the signals being executed should not use the platform.
              </FAQItem>

              <FAQItem q="Does the agent execute every signal it receives?" last>
                No. Each signal is validated against risk rules, account state, and configuration
                before any order is placed. Signals may be rejected for reasons including
                insufficient account balance, a reached daily loss limit, active drawdown controls,
                exposure limits, or invalid signal parameters.
              </FAQItem>
            </FAQGroup>

            <FAQGroup label="Execution">
              <FAQItem q="Where does execution happen?">
                Execution happens on the user&apos;s Windows machine through MetaTrader 5. The AQ
                Agent runs locally and communicates directly with the MT5 terminal. Orders are
                placed from the same machine as the MT5 installation. No order is routed through
                a cloud execution server.
              </FAQItem>

              <FAQItem q="Does Apex Quantel have access to my MT5 credentials?">
                No. MT5 broker credentials are entered into the AQ Agent on the user&apos;s local
                machine. The agent uses them to connect to the locally running MT5 terminal.
                Credentials are not transmitted to Apex Quantel servers.
              </FAQItem>

              <FAQItem q="What happens if the AQ Agent is offline when a signal arrives?">
                Signals received while the agent is offline or disconnected will not be executed.
                The agent also enforces a maximum signal age — signals older than the configured
                threshold are discarded rather than executed late. This prevents stale signals from
                being placed into changed market conditions.
              </FAQItem>

              <FAQItem q="What happens if a trade is rejected?">
                Rejected trades are logged with the reason for rejection. Common reasons include:
                daily loss limit reached, maximum exposure on the symbol already open,
                insufficient equity, or the signal failing the spread-to-SL ratio check. Rejection
                events are visible in the dashboard.
              </FAQItem>

              <FAQItem q="Can I see which trades were rejected and why?" last>
                Yes. The dashboard shows execution events, which include rejection logs with the
                rejection reason. Users can review exactly which signals were acted on and which
                were rejected and why.
              </FAQItem>
            </FAQGroup>

            <FAQGroup label="Risk controls">
              <FAQItem q="What risk controls are available?">
                The execution engine includes: daily loss limit (percent of balance), maximum
                consecutive losing trades, maximum lot size and minimum lot size, maximum equity
                drawdown from recent peak, maximum exposure per symbol, no-hedging rule, stop
                loss to spread ratio threshold, equity throttle (reduces size during drawdown), and
                cluster risk grouping for correlated symbols.
              </FAQItem>

              <FAQItem q="Can I configure or disable risk controls?">
                Risk parameters are configurable in the agent configuration file. However, disabling
                risk controls entirely is not recommended. The controls exist to protect the account
                from uncontrolled loss sequences. Modifying them should be done with a clear
                understanding of the implications.
              </FAQItem>

              <FAQItem q="What is the equity throttle?" last>
                The equity throttle is a risk management feature that automatically reduces position
                size when recent account equity falls below a threshold relative to its rolling
                peak. It halves the risk allocation while the account remains in the throttled
                state, and restores it when equity recovers. It can be enabled or disabled in
                configuration.
              </FAQItem>
            </FAQGroup>

            <FAQGroup label="Technical requirements">
              <FAQItem q="What operating system is required?">
                The AQ Agent currently requires Windows. MetaTrader 5 must be installed on the
                same Windows machine that runs the AQ Agent.
              </FAQItem>

              <FAQItem q="Do I need a VPS?">
                A VPS is not required. The AQ Agent runs on your own Windows machine. If you want
                the agent to run continuously without leaving your personal computer on, a Windows
                VPS is a practical option, but it is not a requirement of the platform.
              </FAQItem>

              <FAQItem q="Does the platform support multiple symbols?" last>
                Yes. The agent handles multiple symbols as configured. Risk controls apply per
                symbol where symbol-specific settings are defined, and globally otherwise.
              </FAQItem>
            </FAQGroup>

            <FAQGroup label="Access and licensing">
              <FAQItem q="What is a licence key?">
                A licence key is generated in the Apex Quantel dashboard after subscribing. It
                links your dashboard account to your AQ Agent installation and authorises it to
                receive signals from the gateway. Each installation requires an active key.
              </FAQItem>

              <FAQItem q="Can I use the licence on multiple machines?">
                Licence terms depend on the plan. Refer to the dashboard for the specific limits
                that apply to your account.
              </FAQItem>

              <FAQItem q="What happens if my licence expires?" last>
                If your licence is inactive or expired, the gateway will not forward signals to
                your AQ Agent. The agent will continue running but will not receive new signals
                until the licence is renewed.
              </FAQItem>
            </FAQGroup>

            <Callout type="important">
              Apex Quantel is execution infrastructure. It automates order placement and trade
              management based on signals it receives. It does not remove trading risk, does not
              provide financial advice, and does not guarantee any trade outcome. Users remain fully
              responsible for their trading accounts and the decisions behind the signals being
              executed.
            </Callout>

            <div style={{ marginTop: 48, paddingTop: 40, borderTop: "1px solid var(--line-soft)", textAlign: "center" }}>
              <p style={{ ...T.body, marginBottom: 24 }}>
                Have a question not covered here? Contact support through the dashboard.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
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
