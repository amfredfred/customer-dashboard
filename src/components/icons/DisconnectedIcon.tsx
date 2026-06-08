import React from "react";
import type { IconProps } from "./types";

/** Disconnected — two separated nodes with a broken rail between them. */
export function DisconnectedIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {/* Left node */}
      <circle cx="4.5" cy="12" r="2.5" />
      {/* Right node */}
      <circle cx="19.5" cy="12" r="2.5" />
      {/* Broken rail — gap in the middle */}
      <path d="M7 12h3.5" />
      <path d="M13.5 12H17" />
      {/* Break marks */}
      <path d="M11 10v4" />
      <path d="M13 10v4" />
    </svg>
  );
}
