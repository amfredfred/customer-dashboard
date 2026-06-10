import React from "react";
import type { IconProps } from "./types";

/** Config controls - three horizontal sliders with knobs at different positions. */
export function SettingsIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {/* Rails */}
      <path d="M3 7h18" />
      <path d="M3 12h18" />
      <path d="M3 17h18" />
      {/* Knobs - at different positions on each rail */}
      <circle cx="8" cy="7" r="2.5" fill="var(--surface,#0d1015)" />
      <circle cx="16" cy="12" r="2.5" fill="var(--surface,#0d1015)" />
      <circle cx="11" cy="17" r="2.5" fill="var(--surface,#0d1015)" />
    </svg>
  );
}
