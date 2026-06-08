import React from "react";
import type { IconProps } from "./types";

/** License key — ring head with a shaft and two notch teeth. */
export function LicenseKeyIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {/* Key head ring */}
      <circle cx="8" cy="11" r="4" />
      {/* Key shaft */}
      <path d="M12 11h9" />
      {/* Notch teeth */}
      <path d="M17.5 11v2.5" />
      <path d="M20.5 11v1.5" />
    </svg>
  );
}
