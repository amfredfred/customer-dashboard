import type { Metadata, Viewport } from "next";
import { SwRegister } from "@/components/sw-register";
import "./globals.css";

// ── Site constants ─────────────────────────────────────────────────────────────
const SITE_URL  = "https://app.somicast.com";
const SITE_NAME = "Apex Quantel";
const SITE_DESC =
  "Automated trading infrastructure for MetaTrader 5. Private signal access, local MT5 execution, live risk controls, and AQ Agent management - all in one secure dashboard.";

// ── JSON-LD structured data ────────────────────────────────────────────────────
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESC,
      inLanguage: "en-US",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icon.png`,
        width: 1024,
        height: 1024,
      },
      sameAs: [],
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web, Windows",
      description: SITE_DESC,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Plans available - see billing page",
      },
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

// ── Root metadata ──────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: `${SITE_NAME} - Automated Trading Infrastructure`,
    template: `%s - ${SITE_NAME}`,
  },
  description: SITE_DESC,

  keywords: [
    "automated trading",
    "MetaTrader 5",
    "MT5 execution",
    "forex signals",
    "algorithmic trading",
    "trade execution",
    "signal relay",
    "AQ Agent",
    "trading dashboard",
    "risk management",
    "forex automation",
    "quantitative trading",
  ],

  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,

  alternates: {
    canonical: "/",
    languages: { "en-US": "/" },
  },

  // OpenGraph
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} - Automated Trading Infrastructure`,
    description: SITE_DESC,
    images: [
      {
        url: `${SITE_URL}/apex-quantel-og.png`,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} - Automated Trading Infrastructure`,
        type: "image/png",
      },
    ],
  },

  // Twitter / X card
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} - Automated Trading Infrastructure`,
    description: SITE_DESC,
    images: [`${SITE_URL}/apex-quantel-og.png`],
  },

  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },

  // Icons - all pointing to icon.png (1024×1024)
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/icon.png",
    apple: [
      { url: "/icon.png", sizes: "1024x1024", type: "image/png" },
    ],
    other: [
      { rel: "apple-touch-icon", url: "/icon.png" },
    ],
  },

  // PWA
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: SITE_NAME,
  },

  // Misc
  formatDetection: { telephone: false },
  category: "finance",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)",  color: "#0a0e14" },
    { media: "(prefers-color-scheme: light)", color: "#0a0e14" },
  ],
};

// ── Root layout ────────────────────────────────────────────────────────────────
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body suppressHydrationWarning>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
