import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";

/** GET /api/admin/me - returns the admin email if auth is valid. */
export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ email: auth.email, isAdmin: true });
}
