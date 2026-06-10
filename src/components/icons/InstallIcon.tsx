import React from "react";
import type { IconProps } from "./types";

/** Installer / download - module package with a downward mount rail. */
export function InstallIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {/* Package module */}
      <rect x="4" y="4" width="16" height="12" rx="2" />
      {/* Content rails */}
      <path d="M8 8h8" />
      <path d="M8 11h5" />
      {/* Mount drop */}
      <path d="M12 16v4" />
      <path d="M9 18l3 3 3-3" />
    </svg>
  );
}
