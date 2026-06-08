import React from "react";
import type { IconProps } from "./types";

/** Gateway / engine connected — two nodes joined by a solid rail with a centre dot. */
export function ConnectionIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {/* Left endpoint */}
      <circle cx="4.5" cy="12" r="2.5" />
      {/* Right endpoint */}
      <circle cx="19.5" cy="12" r="2.5" />
      {/* Connecting rail */}
      <path d="M7 12h10" />
      {/* Centre relay dot */}
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
