import React from "react";
import type { IconProps } from "./types";

/** Live activity trace - flat baseline with one calm pulse burst. */
export function ActivityIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {/* Single continuous trace: flat → pulse → flat */}
      <path d="M3 12h4l2-5 3 9 2.5-7L16 12h5" />
    </svg>
  );
}
