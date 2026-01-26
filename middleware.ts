import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/admin/:path*"],
};

export function middleware(req: NextRequest) {
  const cookieName = process.env.ADMIN_COOKIE_NAME || "pn_admin";
  const hasCookie = req.cookies.get(cookieName)?.value === "1";

  const pathname = req.nextUrl.pathname;

  // Tillåt login + API login/logout utan cookie
  if (
    pathname.startsWith("/admin/login") ||
    pathname.startsWith("/api/admin/login") ||
    pathname.startsWith("/api/admin/logout")
  ) {
    return NextResponse.next();
  }

  if (!hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}