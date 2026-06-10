import React from "react";
import type { IconProps } from "./types";

/** Open detail panel - outer panel frame with a side rail and outward expand indicator. */
export function OpenPanelIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {/* Outer panel */}
      <rect x="3" y="4" width="18" height="16" rx="2" />
      {/* Vertical panel divider */}
      <path d="M15 4v16" />
      {/* Expand indicator in main panel */}
      <path d="M9 10.5l2.5 1.5-2.5 1.5" />
    </svg>
  );
}
