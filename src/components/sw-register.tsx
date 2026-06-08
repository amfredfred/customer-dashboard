"use client";

import { useEffect } from "react";

/**
 * Registers the service worker once the page has loaded.
 * Placed in the root layout so it runs on every page.
 */
export function SwRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => console.warn("SW registration failed:", err));
    });
  }, []);

  return null;
}
