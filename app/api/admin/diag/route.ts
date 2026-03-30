import { NextResponse } from "next/server";
import { cookies } from "next/headers";

async function isAdmin() {
  const cookieName = process.env.ADMIN_COOKIE_NAME || "pn_admin";
  const c = await cookies();
  return c.get(cookieName)?.value === "1";
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    hasService: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.length > 20),
  });
}
