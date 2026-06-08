import React from "react";
import type { IconProps } from "./types";

/** Control-room layout: wide top panel + status block + wide bottom panel. */
export function DashboardIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {/* Wide top panel */}
      <rect x="3" y="3" width="11" height="7" rx="1.5" />
      {/* Compact status block top-right */}
      <rect x="16" y="3" width="5" height="7" rx="1.5" />
      {/* Full-width bottom panel */}
      <rect x="3" y="13" width="18" height="8" rx="1.5" />
      {/* Metric rail inside bottom panel */}
      <path d="M6 17h5" />
      <path d="M6 19h3" />
    </svg>
  );
}
