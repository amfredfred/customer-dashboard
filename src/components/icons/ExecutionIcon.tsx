import React from "react";
import type { IconProps } from "./types";

/** Trade execution route - input node → processing block → output node. */
export function ExecutionIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {/* Input node */}
      <circle cx="4.5" cy="12" r="2" />
      {/* Route in */}
      <path d="M6.5 12h3" />
      {/* Central processing block */}
      <rect x="9.5" y="9" width="5" height="6" rx="1.5" />
      {/* Route out */}
      <path d="M14.5 12h3" />
      {/* Filled output node - result */}
      <circle cx="19.5" cy="12" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}
