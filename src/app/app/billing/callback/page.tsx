"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { gatewayHttpBase } from "@/lib/gateway";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

type VerifyResult = {
  success: boolean;
  planName?: string;
  amount?: string;
  email?: string;
};

function dismiss(to = "/app") {
  window.location.replace(to);
}

/* ── inner component (needs Suspense because of useSearchParams) ─────────── */
function CallbackInner() {
  const params    = useSearchParams();
  const reference = params.get("reference") ?? params.get("trxref") ?? null;

  const [phase, setPhase]   = useState<"loading" | "success" | "error">("loading");
  const [result, setResult] = useState<VerifyResult | null>(null);

  useEffect(() => {
    if (!reference) { setPhase("error"); return; }

    fetch(
      `${gatewayHttpBase()}/billing/verify?reference=${encodeURIComponent(reference)}`,
    )
      .then((r) => r.json() as Promise<VerifyResult>)
      .then((json) => { setResult(json); setPhase(json.success ? "success" : "error"); })
      .catch(() => setPhase("error"));
  }, [reference]);

  /* ── Loading ─────────────────────────────────────────────────────────── */
  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 size={36} className="animate-spin" style={{ color: "var(--success)" }} />
        <div>
          <div className="text-sm font-semibold mb-1">Verifying your payment…</div>
          <div className="text-xs muted">This will only take a moment.</div>
        </div>
      </div>
    );
  }

  /* ── Success ─────────────────────────────────────────────────────────── */
  if (phase === "success") {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "var(--success-bg)", border: "1px solid var(--success-border)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <CheckCircle size={28} style={{ color: "var(--success)" }} />
        </div>

        <div>
          <div className="text-lg font-bold mb-1">You&rsquo;re all set!</div>
          <div className="text-xs muted leading-relaxed max-w-xs">
            {result?.planName
              ? `Your ${result.planName} subscription is now active.`
              : "Your subscription is now active."}
          </div>
        </div>

        {result?.amount && (
          <div style={{
            padding: "0.375rem 1rem",
            background: "var(--success-bg)", border: "1px solid var(--success-border)",
            borderRadius: 20, fontSize: 12, fontWeight: 600, color: "var(--success)",
          }}>
            {result.amount} charged
          </div>
        )}

        <div className="w-full text-left" style={{
          padding: "1rem",
          background: "rgba(255,255,255,.025)", border: "1px solid var(--line)", borderRadius: 8,
        }}>
          <div className="text-xs font-semibold mb-2" style={{ color: "rgba(255,255,255,.6)" }}>
            What happens next
          </div>
          {[
            "Your activation key is being generated and will arrive by email shortly.",
            "Install the AQ Agent on your Windows PC or VPS.",
            "Enter your activation key to connect and start trading.",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2.5 mb-2 last:mb-0">
              <span style={{
                minWidth: 18, height: 18, borderRadius: "50%",
                background: "var(--success-bg)", border: "1px solid var(--success-border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 700, color: "var(--success)", marginTop: 1,
              }}>
                {i + 1}
              </span>
              <span className="text-[11px] muted leading-snug">{step}</span>
            </div>
          ))}
        </div>

        {result?.email && (
          <div className="text-[11px] muted">
            Confirmation sent to{" "}
            <span style={{ color: "rgba(255,255,255,.55)" }}>{result.email}</span>
          </div>
        )}

        <button
          onClick={() => dismiss("/app")}
          className="text-xs font-semibold"
          style={{ color: "var(--success)", background: "none", border: "none", cursor: "pointer" }}
        >
          Go to dashboard →
        </button>
      </div>
    );
  }

  /* ── Error ───────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.2)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <XCircle size={28} style={{ color: "#f87171" }} />
      </div>

      <div>
        <div className="text-lg font-bold mb-1">Payment not confirmed</div>
        <div className="text-xs muted leading-relaxed max-w-xs">
          We couldn&rsquo;t verify your payment. If you were charged, contact support with
          your reference number.
        </div>
      </div>

      {reference && (
        <div style={{
          padding: "0.375rem 0.75rem",
          background: "rgba(255,255,255,.03)", border: "1px solid var(--line)",
          borderRadius: 6, fontSize: 11, color: "rgba(255,255,255,.35)",
          fontFamily: "monospace", wordBreak: "break-all",
        }}>
          ref: {reference}
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          onClick={() => dismiss("/app/billing")}
          className="text-xs font-semibold"
          style={{ color: "var(--success)", background: "none", border: "none", cursor: "pointer" }}
        >
          ← Try again
        </button>
        <span className="muted text-xs">·</span>
        <a href="mailto:support@apexquantel.io" className="text-xs muted hover:opacity-80">
          Contact support
        </a>
      </div>
    </div>
  );
}

/* ── page shell — rendered as a modal overlay ────────────────────────────── */
export default function BillingCallback() {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(0,0,0,.75)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
    }}>
      <div
        className="panel"
        style={{ maxWidth: 420, width: "100%", padding: "2rem", border: "none" }}
      >
        <Suspense fallback={
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin" style={{ color: "var(--success)" }} />
            <div className="text-sm muted">Loading…</div>
          </div>
        }>
          <CallbackInner />
        </Suspense>
      </div>
    </div>
  );
}
