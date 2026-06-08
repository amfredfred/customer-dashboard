import React from "react";
import type { IconProps } from "./types";

/** Install / logs folder — folder outline with a module content rail inside. */
export function FolderModuleIcon({ size = 16, className, style, title }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {/* Folder shape */}
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V7a2 2 0 012-2h5l2 2h9a2 2 0 012 2v10z" />
      {/* Module rail inside */}
      <path d="M7 15h10" />
      <path d="M7 18h6" />
    </svg>
  );
}
