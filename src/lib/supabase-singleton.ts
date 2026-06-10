"use client";
/**
 * Shared browser Supabase singleton.
 *
 * Each call to createBrowserSupabase() creates a new GoTrueClient and
 * triggers Supabase's "multiple instances" warning.  This module ensures
 * that every component outside of auth-provider.tsx shares exactly one
 * client for the lifetime of the browser page.
 *
 * auth-provider.tsx owns its own client (that file cannot be changed here).
 * Using this module everywhere else reduces the count from N instances → 2,
 * eliminating all warnings except the first unavoidable one from auth-provider.
 */
import { createBrowserSupabase } from "@/lib/supabase";

type BrowserClient = ReturnType<typeof createBrowserSupabase>;

let _instance: BrowserClient | undefined;

export function getBrowserSupabase(): BrowserClient {
  if (typeof window === "undefined") {
    // Never cache on the server - each SSR request is independent.
    return null;
  }
  if (_instance === undefined) {
    _instance = createBrowserSupabase();
  }
  return _instance;
}
