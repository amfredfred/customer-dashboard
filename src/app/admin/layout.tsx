"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/components/auth-provider";
import { AdminShell } from "@/components/admin-shell";
import { getBrowserSupabase } from "@/lib/supabase-singleton";

function AdminLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
         style={{ background: "var(--bg)" }}>
      <div className="relative w-10 h-10 rounded-xl flex items-center justify-center"
           style={{ background: "rgba(244,63,94,.1)", border: "1px solid rgba(244,63,94,.25)" }}>
        <div className="absolute inset-0 rounded-xl animate-ping"
             style={{ background: "rgba(244,63,94,.08)", animationDuration: "1.8s" }} />
        <span className="relative text-lg font-bold" style={{ color: "#f43f5e" }}>A</span>
      </div>
      <div className="text-[11px] tracking-[.1em] uppercase" style={{ color: "var(--muted)" }}>
        Verifying admin access…
      </div>
    </div>
  );
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { session, loading, configured } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!loading && configured && !session) {
      router.replace("/login");
      return;
    }
    if (!loading && session) {
      // Verify admin status via API route
      void (async () => {
        const supabase = getBrowserSupabase();
        const { data: { session: s } } = await supabase!.auth.getSession();
        const token = s?.access_token ?? "";
        try {
          const res = await fetch("/api/admin/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            setAllowed(true);
          } else {
            const body = await res.text().catch(() => "");
            console.warn(`[admin] access denied (HTTP ${res.status}): ${body}`);
            router.replace("/app");
          }
        } catch (err) {
          console.warn("[admin] access check failed:", err);
          router.replace("/app");
        } finally {
          setChecking(false);
        }
      })();
    }
  }, [session, loading, configured, router]);

  if (loading || checking) return <AdminLoader />;
  if (!allowed) return null;

  return <AdminShell>{children}</AdminShell>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AdminGuard>{children}</AdminGuard>
    </AuthProvider>
  );
}
