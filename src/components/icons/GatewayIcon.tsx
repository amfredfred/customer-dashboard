import React from "react";
import type { IconProps } from "./types";

/** Apex gateway — central hub node with two connected endpoints. */
export function GatewayIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {/* Central hub */}
      <rect x="8" y="8" width="8" height="8" rx="2" />
      {/* Left endpoint */}
      <circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <path d="M4.5 12H8" />
      {/* Right endpoint */}
      <circle cx="21" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <path d="M16 12h4.5" />
    </svg>
  );
}
