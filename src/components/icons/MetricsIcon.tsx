import React from "react";
import type { IconProps } from "./types";

/** Runtime metrics — two compact KPI blocks on top, one wide panel below. */
export function MetricsIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {/* Top-left KPI block */}
      <rect x="3" y="3" width="8" height="7" rx="1.5" />
      {/* Top-right KPI block */}
      <rect x="13" y="3" width="8" height="7" rx="1.5" />
      {/* Bottom wide panel */}
      <rect x="3" y="13" width="18" height="8" rx="1.5" />
      {/* Value bar inside bottom panel */}
      <path d="M6 18h8" />
    </svg>
  );
}
