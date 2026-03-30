import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const rawNext = url.searchParams.get("next") || "/admin";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/admin";

  const form = await req.formData();
  const password = String(form.get("password") ?? "");

  const correct = process.env.ADMIN_PASSWORD || "";
  const cookieName = process.env.ADMIN_COOKIE_NAME || "pn_admin";

  if (!correct || password !== correct) {
    return NextResponse.redirect(new URL("/admin/login?next=" + encodeURIComponent(next), req.url));
  }

  const res = NextResponse.redirect(new URL(next, req.url));
  res.cookies.set(cookieName, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:" || process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 dagar
  });
  return res;
}
