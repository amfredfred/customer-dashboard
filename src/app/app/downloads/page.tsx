"use client";

import { PageHeader } from "@/components/metric-detail";
import { Monitor, HardDrive } from "lucide-react";
import { ConnectionIcon, EngineIcon, InstallIcon, SuccessIcon } from "@/components/icons";

const DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_ENGINE_DOWNLOAD_URL ?? "https://hwicjxlctpwlgorwpinq.supabase.co/storage/v1/object/public/downloads/AQAgentSetup.exe";

const VERSION      = "0.1.0" ;
const FILE_SIZE    = "28.2 MB";
const FILE_NAME    = "AQAgentSetup.exe";

function Req({ icon: Icon, label, detail }: { icon: React.ElementType; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-white/[.04] border border-white/[.07] grid place-items-center shrink-0">
        <Icon size={14} className="muted" />
      </div>
      <div>
        <div className="text-xs font-semibold">{label}</div>
        <div className="text-xs muted mt-0.5">{detail}</div>
      </div>
    </div>
  );
}

function Step({ n, title, detail }: { n: number; title: string; detail: string }) {
  return (
    <div className="flex gap-4">
      <div className="w-7 h-7 rounded-full border border-white/[.12] grid place-items-center shrink-0 text-xs font-bold text-[#3ddc97]">
        {n}
      </div>
      <div className="pt-0.5">
        <div className="text-sm font-semibold">{title}</div>
        <p className="text-xs muted mt-1 leading-5">{detail}</p>
      </div>
    </div>
  );
}

export default function Downloads() {
  return (
    <div className="page-wrap space-y-6">
      <PageHeader
        eyebrow="Downloads"
        title="AQ Agent"
        description="Install AQ Agent on your Windows PC or VPS alongside MetaTrader 5."
      />

      {/* Main download card */}
      <div className="panel p-6" style={{ borderColor: "rgba(61,220,151,.2)", background: "rgba(61,220,151,.03)" }}>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#3ddc97]/10 border border-[#3ddc97]/25 grid place-items-center shrink-0">
              <InstallIcon size={24} className="text-[#3ddc97]" />
            </div>
            <div>
              <div className="font-bold text-lg tracking-tight">AQ Agent</div>
              <div className="text-xs muted mt-1">
                Windows installer · v{VERSION} · {FILE_SIZE}
              </div>
              <div className="text-xs muted font-mono mt-0.5">{FILE_NAME}</div>
            </div>
          </div>
          <a
            href={DOWNLOAD_URL}
            download={FILE_NAME}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors shrink-0"
            style={{
              background: "#3ddc97",
              color: "#0a0e14",
            }}
          >
            <InstallIcon size={15} />
            Download
          </a>
        </div>

        <div className="mt-5 pt-5 border-t border-white/[.06] grid sm:grid-cols-3 gap-4">
          {[
            ["Platform", "Windows 10 / 11 (64-bit)"],
            ["MetaTrader", "MetaTrader 5 required"],
            ["Architecture", "x86-64 (Intel / AMD)"],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-[10px] uppercase tracking-wider muted mb-1">{label}</div>
              <div className="text-xs font-medium">{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* System requirements */}
        <section>
          <div className="text-[10px] uppercase tracking-[.12em] muted mb-4">System Requirements</div>
          <div className="panel p-5 space-y-5">
            <Req icon={Monitor}        label="Windows 10 or 11 (64-bit)" detail="AQ Agent runs as a Windows Task Scheduler task." />
            <Req icon={EngineIcon}     label="2+ CPU cores recommended"   detail="Signal processing and WebSocket relay." />
            <Req icon={HardDrive}      label="100 MB free disk space"     detail="Logs are written to Program Data." />
            <Req icon={ConnectionIcon} label="Stable internet connection"  detail="Connects to the Apex gateway over WSS." />
          </div>
        </section>

        {/* Setup steps */}
        <section>
          <div className="text-[10px] uppercase tracking-[.12em] muted mb-4">Setup Steps</div>
          <div className="panel p-5 space-y-5">
            <Step n={1} title="Download and run the installer"
              detail="Run AQAgentSetup.exe and follow the on-screen steps. AQ Agent installs to Program Files and registers as a Windows Task Scheduler task." />
            <Step n={2} title="Activate a license key"
              detail="Open Licenses & Keys in this dashboard, copy an activation key, and paste it into AQ Agent's config.yaml." />
            <Step n={3} title="Start MetaTrader 5"
              detail="Open MT5 on the same machine. AQ Agent connects automatically on startup and appears in the My Execution page." />
          </div>
        </section>
      </div>

      {/* Included in the installer */}
      <section>
        <div className="text-[10px] uppercase tracking-[.12em] muted mb-4">What's Included</div>
        <div className="panel p-5">
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              ["Execution agent",       "Core service that connects to MT5 and executes signals."],
              ["Gateway connector",     "Secure WebSocket link to the Apex cloud gateway."],
              ["Config file",           "config.yaml pre-filled with gateway URL and safe defaults."],
              ["Task Scheduler setup",  "Registers as a Windows Task Scheduler task — starts at boot."],
              ["Uninstaller",           "Clean removal included via standard Windows Programs panel."],
              ["Auto-updater ready",    "Version check endpoint wired in — future updates via installer."],
            ].map(([title, detail]) => (
              <div key={title} className="flex gap-3">
                <SuccessIcon size={14} className="text-[#3ddc97] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold">{title}</div>
                  <div className="text-xs muted mt-0.5">{detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Rebuild note */}
      <div className="panel p-4 flex gap-3" style={{ borderColor: "rgba(138,180,255,.2)", background: "rgba(138,180,255,.03)" }}>
        <div className="w-1.5 rounded-full shrink-0 self-stretch" style={{ background: "rgba(138,180,255,.4)" }} />
        <p className="text-xs muted leading-5">
          A new installer is published whenever a new agent version is released.
          Existing installs can be updated by running the new setup file over the current installation.
        </p>
      </div>
    </div>
  );
}
