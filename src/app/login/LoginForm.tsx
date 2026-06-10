"use client";

import { ArrowRight, CheckCircle, Download, KeyRound, LockKeyhole, LogIn, Mail, ShieldCheck, Wand2, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase-singleton";

type AuthMethod = "otp" | "magic";

const DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_ENGINE_DOWNLOAD_URL ?? "https://hwicjxlctpwlgorwpinq.supabase.co/storage/v1/object/public/downloads/AQAgentSetup.exe";

function OtpInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const cells = value.split("").concat(Array(6).fill("")).slice(0, 6);
  return <div className="otp-wrap">{cells.map((cell, index) => <input
    key={index}
    className="otp-cell"
    inputMode="numeric"
    maxLength={1}
    value={cell}
    aria-label={`Digit ${index + 1}`}
    onChange={event => {
      const next = cells.map((current, cellIndex) => cellIndex === index ? event.target.value.replace(/\D/g, "").slice(-1) : current).join("");
      onChange(next);
      if (event.target.value && index < 5) (event.target.parentElement?.children[index + 1] as HTMLInputElement)?.focus();
    }}
    onKeyDown={event => {
      if (event.key === "Backspace" && !cell && index > 0) (event.currentTarget.parentElement?.children[index - 1] as HTMLInputElement)?.focus();
    }}
  />)}</div>;
}

function Feature({ color, title, detail }: { color: string; title: string; detail: string }) {
  return <div className="flex gap-3 items-start"><span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }}/><div><div className="text-[13px] font-semibold text-[#c5cad1]">{title}</div><div className="text-xs muted mt-1 leading-5">{detail}</div></div></div>;
}

export default function LoginForm() {
  const router = useRouter();
  const supabase = getBrowserSupabase();
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<AuthMethod>("otp");
  const [otp, setOtp] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => { if (data.session) router.replace("/app"); });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (url && key) {
      void fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
        .then(response => response.json())
        .then(settings => setGoogleEnabled(Boolean(settings?.external?.google)))
        .catch(() => setGoogleEnabled(false));
    }
  }, [router, supabase]);

  async function sendOtp() {
    if (!supabase || !validEmail) return setMessage(supabase ? "Enter a valid email." : "Supabase public environment variables are required.");
    setLoading(true); setMessage("");
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
    setLoading(false);
    if (error) return setMessage(error.message);
    setOtpStep(true);
  }

  async function verifyOtp() {
    if (!supabase || otp.length !== 6) return;
    setLoading(true); setMessage("");
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: otp, type: "email" });
    setLoading(false);
    if (error) { setOtp(""); return setMessage(error.message); }
    router.replace("/app");
  }

  async function sendMagic() {
    if (!supabase || !validEmail) return setMessage(supabase ? "Enter a valid email." : "Supabase public environment variables are required.");
    setLoading(true); setMessage("");
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/login` } });
    setLoading(false);
    if (error) return setMessage(error.message);
    setMagicSent(true);
  }

  async function signInGoogle() {
    if (!supabase) return setMessage("Supabase public environment variables are required.");
    if (!googleEnabled) return setMessage("Google sign-in is not enabled in the Apex Quantel Supabase project yet.");
    setLoading(true); setMessage("");
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/login`, queryParams: { prompt: "select_account" } } });
    if (error) { setLoading(false); setMessage(error.message); }
  }

  function reset() { setOtp(""); setOtpStep(false); setMagicSent(false); setMessage(""); }

  return <main className="login-shell">
    <aside className="login-panel-left">
      <Link href="/" className="flex items-center gap-3"><img src="/icon.png" alt="Apex" className="w-9 h-9 rounded-md" /><div><div className="text-xs font-bold tracking-[.16em]">APEX</div><div className="text-[9px] uppercase tracking-[.12em] muted mt-0.5">Execution network</div></div></Link>
      <div className="mt-14"><h1 className="text-3xl font-extrabold tracking-[-.035em] leading-[1.15]">Execution<br/><span className="text-[#3ddc97]">control plane.</span></h1><p className="text-[13px] muted leading-6 mt-4">Monitor licensed AQ Agents, activation keys, and execution telemetry from one secure control plane.</p></div>
      <div className="mt-11 space-y-5"><Feature color="#3ddc97" title="Local execution" detail="Your installed engine and MT5 account keep the final say."/><Feature color="#60a5fa" title="Risk guardrails" detail="Track daily budget, drawdown, and execution health."/><Feature color="#f5b942" title="Private signal access" detail="Demand-driven metrics and licensed signal routing."/><Feature color="#8b5cf6" title="One control plane" detail="Manage AQ Agents, billing, and activation keys securely."/></div>

      {/* Download the agent */}
      <div className="mt-8 p-4 rounded-xl border border-white/[.08] bg-white/[.025]">
        <div className="text-[10px] uppercase tracking-[.12em] muted mb-3">Get Started</div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold">Download the Agent</div>
            <div className="text-[11px] muted mt-0.5">Windows installer · AQAgentSetup.exe</div>
          </div>
          <a
            href={DOWNLOAD_URL}
            download="AQAgentSetup.exe"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 transition-opacity hover:opacity-80"
            style={{ background: "rgba(61,220,151,.15)", color: "#3ddc97", border: "1px solid rgba(61,220,151,.25)" }}
          >
            <Download size={11} />
            Download
          </a>
        </div>
      </div>

      <p className="text-[10px] muted leading-5 mt-4">By continuing you agree to Apex Quantel&apos;s Terms and Privacy Policy.</p>
    </aside>
    <section className="login-panel-right"><div className="login-form">
      <div className="mb-8"><h2 className="text-2xl font-bold">Sign in to Apex Quantel</h2><p className="text-[13px] muted mt-2">Passwordless authentication - use Google, a one-time code, or a magic link.</p></div>
      {!supabase && <div className="panel p-4 mb-5 border-[#f5b942]/30"><div className="text-xs font-bold uppercase tracking-wider text-[#f5b942]">Supabase setup required</div><div className="text-xs muted mt-2 leading-5">Add the public Supabase URL and publishable key to the dashboard environment.</div></div>}
      <button onClick={() => void signInGoogle()} disabled={!supabase || !googleEnabled || loading} className="auth-google"><svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>{loading ? "Redirecting..." : googleEnabled === false ? "Google sign-in not enabled" : "Continue with Google"}</button>
      <div className="auth-divider"><span/>OR<span/></div>
      {otpStep ? <div className="space-y-4"><div className="panel p-4"><div className="text-xs font-semibold">Check your inbox</div><div className="text-xs muted mt-1">Six-digit code sent to <strong className="text-white">{email}</strong></div></div><OtpInput value={otp} onChange={setOtp}/><button disabled={otp.length !== 6 || loading} onClick={() => void verifyOtp()} className="auth-primary">Verify code <ArrowRight size={13}/></button><div className="flex justify-between"><button onClick={reset} className="auth-link">Change email</button><button onClick={() => void sendOtp()} className="auth-link text-[#60a5fa]">Resend code</button></div></div>
      : magicSent ? <div className="panel p-4 flex gap-3"><CheckCircle size={17} className="text-[#3ddc97] shrink-0"/><div><div className="text-sm font-semibold">Magic link sent</div><div className="text-xs muted mt-1 leading-5">Open the link in your email to securely enter Apex Quantel.</div><button onClick={reset} className="auth-link mt-3">Use a different email</button></div></div>
      : <div className="space-y-4"><div className="auth-tabs"><button onClick={() => setMethod("otp")} className={method === "otp" ? "active" : ""}><LogIn size={11}/> OTP code</button><button onClick={() => setMethod("magic")} className={method === "magic" ? "active" : ""}><Wand2 size={11}/> Magic link</button></div><label className="auth-email"><Mail size={14}/><input type="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void (method === "otp" ? sendOtp() : sendMagic()); }}/></label><button disabled={!supabase || !validEmail || loading} onClick={() => void (method === "otp" ? sendOtp() : sendMagic())} className="auth-primary">{method === "otp" ? <><LogIn size={13}/> Send code</> : <><Wand2 size={13}/> Send magic link</>}</button></div>}
      {message && <div className="text-xs text-[#f5b942] mt-4">{message}</div>}
      <div className="auth-benefits">{[[LockKeyhole,"No password"],[Zap,"Instant"],[ShieldCheck,"Secure"],[KeyRound,"One account"]].map(([Icon,label]) => <div key={String(label)}><Icon size={14}/><span>{String(label)}</span></div>)}</div>
    </div></section>
  </main>;
}
