import React from "react";
import type { IconProps } from "./types";

/** Threshold warning — restrained diamond frame with inner exclamation. */
export function WarningIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {/* Diamond threshold frame */}
      <path d="M12 4.5l7.5 7.5-7.5 7.5-7.5-7.5z" />
      {/* Exclamation line */}
      <path d="M12 9.5v4" />
      {/* Dot */}
      <circle cx="12" cy="15.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
