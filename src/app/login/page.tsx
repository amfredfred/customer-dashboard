import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to your Apex Quantel dashboard. Access MT5 execution controls, live trading signals, and AQ Agent management. Google OAuth, magic link, or one-time code.",
  alternates: { canonical: "/login" },
  robots: { index: true, follow: false },
  openGraph: {
    title: "Sign In — Apex Quantel",
    description:
      "Sign in to your Apex Quantel dashboard. Secure access via Google, magic link, or one-time code.",
    url: "https://app.somicast.com/login",
    type: "website",
    images: [
      {
        url: "https://app.somicast.com/apex-quantel-og.png",
        width: 1200,
        height: 630,
        alt: "Sign In — Apex Quantel",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sign In — Apex Quantel",
    description: "Sign in to your Apex Quantel dashboard.",
    images: ["https://app.somicast.com/apex-quantel-og.png"],
  },
};

export default function LoginPage() {
  return <LoginForm />;
}
