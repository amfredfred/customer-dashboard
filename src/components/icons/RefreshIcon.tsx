import React from "react";
import type { IconProps } from "./types";

/** Reconnect / refresh — restrained circular flow arc with arrowhead. */
export function RefreshIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {/* 3/4 arc */}
      <path d="M21 12a9 9 0 11-2.6-6.4" />
      {/* Arrow head on the arc end */}
      <path d="M21 4.5V9h-4.5" />
    </svg>
  );
}
