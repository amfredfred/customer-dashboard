"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { SignalEngineProvider } from "@/components/signal-engine-provider";
import { ExecutionEngineProvider } from "@/components/execution-engine-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SignalEngineProvider>
      <ExecutionEngineProvider>
        <DashboardShell>{children}</DashboardShell>
      </ExecutionEngineProvider>
    </SignalEngineProvider>
  );
}
