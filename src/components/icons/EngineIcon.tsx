import React from "react";
import type { IconProps } from "./types";

/** Execution engine module - rounded square with three compute rails inside. */
export function EngineIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {/* Module casing */}
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      {/* Compute rails */}
      <path d="M8 9h8" />
      <path d="M8 12h8" />
      <path d="M8 15h8" />
    </svg>
  );
}
