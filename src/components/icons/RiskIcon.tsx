import React from "react";
import type { IconProps } from "./types";

/** Risk guardrail — shield boundary with inner threshold line and guarded point. */
export function RiskIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {/* Guard boundary */}
      <path d="M12 3L20.5 6.5V12.5c0 4.2-3.5 7-8.5 8.5C7 19.5 3.5 16.7 3.5 12.5V6.5L12 3z" />
      {/* Threshold line */}
      <path d="M8 13h8" />
      {/* Guarded value point */}
      <circle cx="12" cy="13" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
