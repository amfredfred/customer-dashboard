import React from "react";
import type { IconProps } from "./types";

/** Signal stream — origin point, controlled pulse line, delivery endpoint. */
export function SignalIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {/* Origin node */}
      <circle cx="3.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      {/* Short lead-in */}
      <path d="M5 12h1" />
      {/* Signal pulse — calm ECG trace */}
      <path d="M6 12l2-5 2.5 9 2.5-7 2 3" />
      {/* Lead-out */}
      <path d="M15 12h2" />
      {/* Delivery endpoint */}
      <circle cx="19" cy="12" r="2.5" />
    </svg>
  );
}
