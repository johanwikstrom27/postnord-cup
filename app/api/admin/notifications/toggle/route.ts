import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase";
import { setNotificationsPaused } from "@/lib/notificationPause";

export const runtime = "nodejs";

async function isAdmin() {
  const cookieName = process.env.ADMIN_COOKIE_NAME || "pn_admin";
  const c = await cookies();
  const v = c.get(cookieName)?.value;
  return v === "1";
}

function withParam(rawNext: string, key: string, value: string, reqUrl: string) {
  const url = new URL(rawNext || "/admin", reqUrl);
  url.searchParams.set(key, value);
  return url;
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const next = String(form.get("next") ?? "/admin");
  const paused = String(form.get("paused") ?? "").toLowerCase() === "true";

  const sb = supabaseServer();
  const upd = await setNotificationsPaused(sb, paused);

  if (!upd.ok) {
    const key = upd.missingColumn ? "notif_schema" : "notif_error";
    const val = upd.missingColumn ? "missing" : "1";
    return NextResponse.redirect(withParam(next, key, val, req.url));
  }

  return NextResponse.redirect(withParam(next, "notif", paused ? "off" : "on", req.url));
}
