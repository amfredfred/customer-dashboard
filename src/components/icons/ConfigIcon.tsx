import React from "react";
import type { IconProps } from "./types";

/** Config file — document outline with structured key-value rows inside. */
export function ConfigIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {/* Document outline with folded corner */}
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
      <path d="M14 3v5h5" />
      {/* Config rows — different widths suggest key-value structure */}
      <path d="M9 12h3" />
      <path d="M14 12h2" />
      <path d="M9 15h5" />
      <path d="M9 18h4" />
    </svg>
  );
}
