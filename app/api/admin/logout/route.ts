import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const cookieName = process.env.ADMIN_COOKIE_NAME || "pn_admin";
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set(cookieName, "", { path: "/", maxAge: 0 });
  return res;
}