import React from "react";
import type { IconProps } from "./types";

/** Terminal log viewer - framed terminal with prompt and output lines. */
export function LogsIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {/* Terminal frame */}
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      {/* Prompt caret */}
      <path d="M7 9l2.5 2-2.5 2" />
      {/* Log output lines */}
      <path d="M12 9h6" />
      <path d="M12 13h5" />
      <path d="M12 17h4" />
    </svg>
  );
}
