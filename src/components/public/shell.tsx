import Link from "next/link";
import type { ReactNode, CSSProperties } from "react";

// ── Shared constants ─────────────────────────────────────────────────────────

export const DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_ENGINE_DOWNLOAD_URL ??
  "https://hwicjxlctpwlgorwpinq.supabase.co/storage/v1/object/public/downloads/AQAgentSetup.exe";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.somicast.com";

// ── Typography scale ─────────────────────────────────────────────────────────

export const T = {
  h1: {
    margin: "0 0 22px",
    fontSize: "clamp(38px, 5.5vw, 68px)",
    fontWeight: 800,
    letterSpacing: "-.045em",
    lineHeight: 1.02,
    color: "var(--text)",
  } as CSSProperties,

  h2: {
    margin: "0 0 14px",
    fontSize: "clamp(25px, 3vw, 38px)",
    fontWeight: 750,
    letterSpacing: "-.035em",
    color: "var(--text)",
  } as CSSProperties,

  h3: {
    margin: "0 0 7px",
    fontSize: 14.5,
    fontWeight: 700,
    letterSpacing: "-.01em",
    color: "var(--text)",
  } as CSSProperties,

  body: {
    fontSize: 13.5,
    color: "var(--muted)",
    lineHeight: 1.75,
    margin: 0,
  } as CSSProperties,

  label: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: ".12em",
    textTransform: "uppercase" as const,
    color: "var(--muted)",
  } as CSSProperties,

  mono: {
    fontFamily: "SFMono-Regular,Consolas,monospace",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: ".04em",
    color: "var(--muted)",
  } as CSSProperties,
};

// ── Layout primitives ────────────────────────────────────────────────────────

export function Container({
  children,
  narrow = false,
  className = "",
}: {
  children: ReactNode;
  narrow?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto px-5 sm:px-10 ${className}`}
      style={{ maxWidth: narrow ? 760 : 1180 }}
    >
      {children}
    </div>
  );
}

export function Section({
  children,
  surface = false,
  noBorderTop = false,
  py = 68,
}: {
  children: ReactNode;
  surface?: boolean;
  noBorderTop?: boolean;
  py?: number;
}) {
  return (
    <section
      className={surface ? "public-section public-section-surface" : "public-section"}
      style={{
        borderTop: noBorderTop ? "none" : "1px solid var(--line-soft)",
        padding: `${py}px 0`,
      }}
    >
      {children}
    </section>
  );
}

// ── Typography components ────────────────────────────────────────────────────

export function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <div style={{ width: 16, height: 2, background: "var(--success)", flexShrink: 0 }} />
      <span style={T.label}>{text}</span>
    </div>
  );
}

export function PageHero({
  label,
  heading,
  sub,
}: {
  label?: string;
  heading: string;
  sub: string;
}) {
  return (
    <section className="public-page-hero" style={{ padding: "104px 0 82px" }}>
      <Container>
        {label && <SectionLabel text={label} />}
        <h1 style={{ ...T.h1, maxWidth: 680 }}>{heading}</h1>
        <p style={{ ...T.body, fontSize: 15, maxWidth: 580 }}>{sub}</p>
      </Container>
    </section>
  );
}

// ── Content blocks ───────────────────────────────────────────────────────────

export function Callout({
  children,
  type = "note",
}: {
  children: ReactNode;
  type?: "note" | "warning" | "important";
}) {
  const accent =
    type === "warning"
      ? "var(--warning)"
      : type === "important"
      ? "var(--danger)"
      : "var(--line-strong)";
  const label =
    type === "warning" ? "Warning" : type === "important" ? "Important" : "Note";

  return (
    <div
      style={{
        borderLeft: `2px solid ${accent}`,
        padding: "12px 0 12px 18px",
        marginTop: 28,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".10em",
          textTransform: "uppercase",
          color: accent,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ ...T.body, fontSize: 13 }}>{children}</div>
    </div>
  );
}

export function DefinitionCard({
  term,
  definition,
}: {
  term: string;
  definition: string;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: "14px 18px",
        background: "var(--surface-2)",
        marginTop: 20,
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 800,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "var(--muted)",
          marginBottom: 6,
        }}
      >
        {term}
      </div>
      <div style={{ ...T.body, fontSize: 13 }}>{definition}</div>
    </div>
  );
}

export function FlowStep({
  n,
  title,
  children,
  last = false,
}: {
  n: string;
  title: string;
  children: ReactNode;
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
        <div style={T.body}>{children}</div>
      </div>
    </div>
  );
}

export function FAQItem({
  q,
  children,
  last = false,
}: {
  q: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      style={{
        padding: "22px 0",
        borderBottom: last ? "none" : "1px solid var(--line-soft)",
      }}
    >
      <h3 style={{ ...T.h3, fontSize: 14, marginBottom: 10 }}>{q}</h3>
      <div style={T.body}>{children}</div>
    </div>
  );
}

export function ProseSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "var(--text)",
          margin: "0 0 10px",
          letterSpacing: "-.01em",
        }}
      >
        {heading}
      </h2>
      <div style={{ ...T.body, fontSize: 13.5 }}>{children}</div>
    </div>
  );
}

// ── Navigation ───────────────────────────────────────────────────────────────

export function PublicNav() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "var(--base)",
        borderBottom: "1px solid var(--line-soft)",
      }}
    >
      <div
        className="mx-auto px-5 sm:px-10"
        style={{
          maxWidth: 1180,
          display: "flex",
          alignItems: "center",
          height: 54,
          gap: 32,
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
          <img
            src="/icon.png"
            alt="Apex Quantel"
            style={{ width: 24, height: 24, borderRadius: 5 }}
          />
          <span
            style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".01em", color: "var(--text)" }}
          >
            Apex Quantel
          </span>
        </Link>

        <nav className="hidden sm:flex items-center gap-6" style={{ flex: 1 }}>
          {[
            ["Features", "/features"],
            ["How it works", "/how-it-works"],
            ["FAQ", "/faq"],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              style={{ fontSize: 13, fontWeight: 500, color: "var(--muted)", whiteSpace: "nowrap" }}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginLeft: "auto",
            flexShrink: 0,
          }}
        >
          <a
            href={DOWNLOAD_URL}
            download="AQAgentSetup.exe"
            className="hidden sm:inline-flex items-center"
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--muted)",
              padding: "6px 13px",
              borderRadius: 7,
              border: "1px solid var(--line)",
            }}
          >
            Download Agent
          </a>
          <Link
            href="/login"
            className="public-primary-button"
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: "#03120c",
              background: "var(--success)",
              border: "0",
              padding: "6px 20px",
              borderRadius: 7,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────────

export function PublicFooter() {
  return (
    <footer style={{ borderTop: "1px solid var(--line-soft)", padding: "48px 0 32px" }}>
      <div className="mx-auto px-5 sm:px-10" style={{ maxWidth: 1180 }}>
        <div className="grid sm:grid-cols-4 gap-8 mb-10">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <img
                src="/icon.png"
                alt="Apex Quantel"
                style={{ width: 20, height: 20, borderRadius: 4 }}
              />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>
                Apex Quantel
              </span>
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.65, margin: 0 }}>
              Automated MT5 execution infrastructure for private trading signals.
            </p>
          </div>

          <div>
            <div style={{ ...T.label, display: "block", marginBottom: 12 }}>Product</div>
            {[
              ["Features", "/features"],
              ["How it works", "/how-it-works"],
              ["FAQ", "/faq"],
            ].map(([label, href]) => (
              <div key={href} style={{ marginBottom: 8 }}>
                <Link href={href} style={{ fontSize: 13, color: "var(--muted)" }}>
                  {label}
                </Link>
              </div>
            ))}
          </div>

          <div>
            <div style={{ ...T.label, display: "block", marginBottom: 12 }}>Legal</div>
            {[
              ["Terms of Service", "/terms"],
              ["Privacy Policy", "/privacy"],
            ].map(([label, href]) => (
              <div key={href} style={{ marginBottom: 8 }}>
                <Link href={href} style={{ fontSize: 13, color: "var(--muted)" }}>
                  {label}
                </Link>
              </div>
            ))}
          </div>

          <div>
            <div style={{ ...T.label, display: "block", marginBottom: 12 }}>Access</div>
            <div style={{ marginBottom: 8 }}>
              <Link href="/login" style={{ fontSize: 13, color: "var(--muted)" }}>
                Sign in
              </Link>
            </div>
            <div>
              <a
                href={DOWNLOAD_URL}
                download="AQAgentSetup.exe"
                style={{ fontSize: 13, color: "var(--muted)" }}
              >
                Download Agent
              </a>
            </div>
          </div>
        </div>

        <div
          style={{
            paddingTop: 20,
            borderTop: "1px solid var(--line-soft)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            © {new Date().getFullYear()} Apex Quantel. All rights reserved.
          </span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            Execution infrastructure. Not financial advice.
          </span>
        </div>
      </div>
    </footer>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="public-shell"
      style={{
        background: "var(--base)",
        color: "var(--text)",
        fontFamily: "Inter,ui-sans-serif,system-ui,sans-serif",
        minHeight: "100vh",
        overflowX: "hidden",
      }}
    >
      <PublicNav />
      {children}
      <PublicFooter />
    </div>
  );
}
