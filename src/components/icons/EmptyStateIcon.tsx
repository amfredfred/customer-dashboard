import React from "react";
import type { IconProps } from "./types";

/** No data — quiet panel outline with empty content rails. */
export function EmptyStateIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {/* Panel frame */}
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      {/* Header separator */}
      <path d="M3 9.5h18" />
      {/* Empty content rails */}
      <path d="M7 13h5" strokeOpacity="0.4" />
      <path d="M7 16h3" strokeOpacity="0.3" />
    </svg>
  );
}
