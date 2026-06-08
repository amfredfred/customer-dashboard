import React from "react";
import type { IconProps } from "./types";

/** Healthy / completed — precise clean checkmark. */
export function SuccessIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <path d="M4.5 12.5l5 5L20 7" />
    </svg>
  );
}
