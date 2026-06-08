import React from "react";
import type { IconProps } from "./types";

/** Failed / error state — clean cross inside a subtle circle. */
export function ErrorIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {/* Containing circle */}
      <circle cx="12" cy="12" r="9" />
      {/* Cross */}
      <path d="M9 9l6 6" />
      <path d="M15 9l-6 6" />
    </svg>
  );
}
