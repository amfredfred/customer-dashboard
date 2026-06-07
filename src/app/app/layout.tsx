"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider,useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { GatewayProvider } from "@/components/gateway-provider";
function Guard({children}:{children:React.ReactNode}) { const {session,loading,configured}=useAuth(); const router=useRouter(); useEffect(()=>{if(!loading&&configured&&!session)router.replace("/login");},[session,loading,configured,router]); if(loading)return <div className="min-h-screen grid place-items-center muted text-sm">Loading TradeRelay...</div>; return <GatewayProvider><DashboardShell>{children}</DashboardShell></GatewayProvider>; }
export default function AppLayout({children}:{children:React.ReactNode}) { return <AuthProvider><Guard>{children}</Guard></AuthProvider>; }
