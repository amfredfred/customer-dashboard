import React from "react";
import type { IconProps } from "./types";

/** Background service / daemon process — module block with inner rails and a centre running indicator. */
export function ServiceIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {/* Process block */}
      <rect x="4" y="4" width="16" height="16" rx="3" />
      {/* Top rail */}
      <path d="M8 9h8" />
      {/* Bottom rail */}
      <path d="M8 15h8" />
      {/* Running indicator — small dot at centre */}
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
