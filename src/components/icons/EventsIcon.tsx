import React from "react";
import type { IconProps } from "./types";

/** Execution event timeline - vertical spine with three event nodes and content rails. */
export function EventsIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {/* Vertical timeline spine */}
      <path d="M8 4v16" />
      {/* Event nodes */}
      <circle cx="8" cy="6.5" r="2" />
      <circle cx="8" cy="12" r="2" />
      <circle cx="8" cy="17.5" r="2" />
      {/* Content rails to the right */}
      <path d="M11 6.5h8" />
      <path d="M11 12h7" />
      <path d="M11 17.5h5" />
    </svg>
  );
}
