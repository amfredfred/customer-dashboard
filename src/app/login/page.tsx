import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to Apex Quant Trader — no password required. Use Google OAuth, a one-time code, or a magic link.",
  robots: { index: true, follow: false },
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  return <LoginForm />;
}
