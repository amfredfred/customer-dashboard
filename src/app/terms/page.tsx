import type { Metadata } from "next";
import {
  PublicShell,
  Container,
  Section,
  PageHero,
  ProseSection,
  Callout,
  T,
  SITE_URL,
} from "@/components/public/shell";

export const metadata: Metadata = {
  title: "Terms of Service | Apex Quantel",
  description:
    "Read the Apex Quantel terms covering software access, trading risk, user responsibility, licences, and service limitations.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service | Apex Quantel",
    description: "Terms covering software access, trading risk, user responsibility, and service limitations.",
    url: `${SITE_URL}/terms`,
    siteName: "Apex Quantel",
    images: [{ url: `${SITE_URL}/apex-quantel-og.png`, width: 1200, height: 630, alt: "Apex Quantel Terms", type: "image/png" }],
    type: "website",
  },
};

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        marginBottom: 8,
        fontSize: 13.5,
        color: "var(--muted)",
        lineHeight: 1.7,
      }}
    >
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--line-strong)", marginTop: 9, flexShrink: 0 }} />
      <span>{children}</span>
    </li>
  );
}

export default function TermsPage() {
  return (
    <PublicShell>
      <main>
        <PageHero
          label="Legal"
          heading="Terms of Service."
          sub="These terms govern your access to and use of Apex Quantel. Please read them carefully before using the platform."
        />

        <Section>
          <Container narrow>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 40, paddingBottom: 20, borderBottom: "1px solid var(--line-soft)" }}>
              Last updated: June 2026
            </div>

            <Callout type="note">
              These terms are provided as a plain-language starting point. We recommend having them
              reviewed by a qualified legal professional before relying on them in a commercial context.
            </Callout>

            <div style={{ marginTop: 40 }}>
              <ProseSection heading="1. Agreement to terms">
                <p>
                  By accessing or using Apex Quantel (the &quot;Platform&quot;, the
                  &quot;Service&quot;), you agree to be bound by these Terms of Service. If you do
                  not agree to these terms, do not use the Platform.
                </p>
              </ProseSection>

              <ProseSection heading="2. Description of service">
                <p>Apex Quantel provides a trading execution system consisting of:</p>
                <ul style={{ margin: "12px 0", padding: 0, listStyle: "none" }}>
                  <Li>A web-based dashboard for account management, licence administration, and monitoring</Li>
                  <Li>A Windows desktop application (the &quot;AQ Agent&quot;) for local MetaTrader 5 execution</Li>
                  <Li>A signal routing gateway that distributes approved trading signals to licensed users</Li>
                </ul>
                <p style={{ marginTop: 12 }}>
                  The Platform provides the infrastructure for executing trading signals. It does not
                  generate trading signals, provide investment advice, or manage trading accounts on
                  your behalf.
                </p>
              </ProseSection>

              <ProseSection heading="3. Trading risk acknowledgement">
                <p>
                  Trading financial instruments carries significant risk. Using Apex Quantel does not
                  reduce or eliminate this risk. The Platform executes signals within configured
                  parameters. It does not guarantee trade outcomes, signal accuracy, or profitable
                  results. You may lose some or all of your invested capital.
                </p>
                <p style={{ marginTop: 12 }}>
                  By using the Platform, you acknowledge that you understand the financial risks
                  involved in trading and accept full responsibility for any losses incurred.
                </p>
              </ProseSection>

              <ProseSection heading="4. No financial advice">
                <p>
                  Nothing provided by Apex Quantel constitutes financial advice, investment advice,
                  or a recommendation to trade any instrument. Trading signals routed through the
                  Platform originate from a third-party signal source and are not a recommendation
                  from Apex Quantel. You are responsible for evaluating and understanding any trade
                  executed on your account.
                </p>
              </ProseSection>

              <ProseSection heading="5. User responsibilities">
                <p>You are responsible for:</p>
                <ul style={{ margin: "12px 0", padding: 0, listStyle: "none" }}>
                  <Li>Understanding the risks of trading financial instruments</Li>
                  <Li>Configuring risk parameters appropriate to your account size and risk tolerance</Li>
                  <Li>Maintaining a properly installed and connected AQ Agent</Li>
                  <Li>Monitoring your MetaTrader 5 account and executed trades</Li>
                  <Li>Ensuring your broker permits automated order placement</Li>
                  <Li>Keeping your licence key and account credentials secure</Li>
                  <Li>Complying with the terms of your broker and any applicable financial regulations</Li>
                </ul>
              </ProseSection>

              <ProseSection heading="6. Licence and access">
                <p>
                  Apex Quantel grants you a limited, non-transferable licence to use the Platform
                  subject to these Terms. Your licence is tied to your dashboard account and the
                  AQ Agent installation associated with your licence key. You may not share, resell,
                  transfer, or distribute your licence key or access to the Platform.
                </p>
                <p style={{ marginTop: 12 }}>
                  Access to the Platform requires an active subscription. Features and signal access
                  may vary by plan.
                </p>
              </ProseSection>

              <ProseSection heading="7. Local execution dependency">
                <p>
                  The execution of trades depends on factors outside of our control, including:
                </p>
                <ul style={{ margin: "12px 0", padding: 0, listStyle: "none" }}>
                  <Li>The AQ Agent being installed, running, and connected on your Windows machine</Li>
                  <Li>A functioning MetaTrader 5 installation connected to your broker</Li>
                  <Li>A stable internet connection on the user&apos;s machine</Li>
                  <Li>Your broker&apos;s platform being operational</Li>
                </ul>
                <p style={{ marginTop: 12 }}>
                  We are not responsible for failed or missed executions resulting from local
                  software issues, disconnections, broker downtime, or other conditions outside
                  the Platform&apos;s control.
                </p>
              </ProseSection>

              <ProseSection heading="8. Third-party platforms">
                <p>
                  Apex Quantel integrates with MetaTrader 5, which is a product of MetaQuotes
                  Software Corp. We are not affiliated with or endorsed by MetaQuotes. Your use
                  of MetaTrader 5 is governed by MetaQuotes&apos; terms and your broker&apos;s
                  terms, which apply independently of these Terms.
                </p>
                <p style={{ marginTop: 12 }}>
                  Authentication services are provided by Supabase, Inc. Payment processing is
                  handled by a third-party processor. Their respective terms and policies apply to
                  those services.
                </p>
              </ProseSection>

              <ProseSection heading="9. Service availability">
                <p>
                  We do not guarantee uninterrupted or error-free access to the Platform. The
                  gateway, dashboard, or signal routing may be unavailable due to scheduled
                  maintenance, technical issues, or events outside our control. We will endeavour
                  to provide advance notice of planned maintenance where possible.
                </p>
              </ProseSection>

              <ProseSection heading="10. Limitation of liability">
                <p>
                  To the maximum extent permitted by applicable law, Apex Quantel and its operators
                  shall not be liable for:
                </p>
                <ul style={{ margin: "12px 0", padding: 0, listStyle: "none" }}>
                  <Li>Trading losses, including losses resulting from signal execution, failed execution, or risk control misconfiguration</Li>
                  <Li>Loss arising from system downtime, delays, or technical failures</Li>
                  <Li>Loss of data or configuration</Li>
                  <Li>Indirect, incidental, or consequential damages of any kind</Li>
                </ul>
                <p style={{ marginTop: 12 }}>
                  Our total liability to you for any claim arising from these Terms or your use of
                  the Platform shall not exceed the amount paid by you in the twelve months preceding
                  the claim.
                </p>
              </ProseSection>

              <ProseSection heading="11. Account termination">
                <p>
                  We reserve the right to suspend or terminate your access to the Platform at our
                  discretion, including for violation of these Terms, non-payment, fraudulent use,
                  or conduct that we determine to be harmful to the Platform or other users. Upon
                  termination, your licence key will be deactivated and signal routing to your agent
                  will cease.
                </p>
              </ProseSection>

              <ProseSection heading="12. Changes to terms">
                <p>
                  We may update these Terms from time to time. Where changes are material, we will
                  provide notice through the dashboard or by email. Continued use of the Platform
                  after revised Terms are published constitutes acceptance of the changes.
                </p>
              </ProseSection>

              <ProseSection heading="13. Governing law and contact">
                <p>
                  These Terms are governed by applicable law in the jurisdiction of the operator.
                  If you have questions about these Terms or the Platform, contact us through the
                  support channel in your dashboard.
                </p>
              </ProseSection>
            </div>

            <div
              style={{
                marginTop: 40,
                paddingTop: 24,
                borderTop: "1px solid var(--line-soft)",
                fontSize: 12,
                color: "var(--muted)",
                lineHeight: 1.7,
              }}
            >
              <span style={{ ...T.label, display: "inline-block", marginBottom: 8 }}>Legal review note</span>
              <p style={{ margin: 0 }}>
                These terms are provided as a plain-language starting point and have not been
                reviewed by a legal professional. We strongly recommend having them reviewed by
                a qualified legal professional before operating in a commercial context.
              </p>
            </div>
          </Container>
        </Section>
      </main>
    </PublicShell>
  );
}
