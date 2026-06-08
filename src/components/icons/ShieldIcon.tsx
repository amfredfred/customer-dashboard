import React from "react";
import type { IconProps } from "./types";

/** Protected state — clean shield with inner guard check line. */
export function ShieldIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {/* Shield outline */}
      <path d="M12 3L20 6.5V12c0 4.4-3.4 7.3-8 9C9 19.3 4 16.4 4 12V6.5L12 3z" />
      {/* Inner check */}
      <path d="M9 12.5l2.5 2.5 4-4.5" />
    </svg>
  );
}
