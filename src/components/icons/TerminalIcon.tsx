import React from "react";
import type { IconProps } from "./types";

/** CLI / service console - compact terminal with prompt and one output rail. */
export function TerminalIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {/* Frame */}
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      {/* Prompt caret */}
      <path d="M7 12l3 2-3 2" />
      {/* Output line */}
      <path d="M13 16h5" />
    </svg>
  );
}
