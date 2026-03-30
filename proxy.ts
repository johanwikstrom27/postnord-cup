import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

export function proxy(req: NextRequest) {
  const cookieName = process.env.ADMIN_COOKIE_NAME || "pn_admin";
  const hasCookie = req.cookies.get(cookieName)?.value === "1";

  const pathname = req.nextUrl.pathname;

  if (
    pathname.startsWith("/admin/login") ||
    pathname.startsWith("/api/admin/login") ||
    pathname.startsWith("/api/admin/logout") ||
    pathname.startsWith("/api/admin/notify-on-lock")
  ) {
    return NextResponse.next();
  }

  if (!hasCookie) {
    if (pathname.startsWith("/api/admin/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
