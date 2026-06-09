"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Root redirects to /app — auth guard there sends unauthenticated users
// to /login. Using client-side redirect so static export works on
// Cloudflare Pages (server redirect() is not available in output:"export").
export default function Root() {
  const router = useRouter();
  useEffect(() => { router.replace("/app"); }, [router]);
  return null;
}
 