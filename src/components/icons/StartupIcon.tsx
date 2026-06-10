import React from "react";
import type { IconProps } from "./types";

/** Auto-start / boot preference - process block with launch rail at top. */
export function StartupIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {/* Process block */}
      <rect x="5" y="8" width="14" height="11" rx="2.5" />
      {/* Launch indicator - vertical rail from top */}
      <path d="M12 3v5" />
      <path d="M9.5 5.5L12 3l2.5 2.5" />
      {/* Running state line inside block */}
      <path d="M9 14h6" />
    </svg>
  );
}
