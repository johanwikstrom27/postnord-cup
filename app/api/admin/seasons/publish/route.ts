import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

async function isAdmin() {
  const cookieName = process.env.ADMIN_COOKIE_NAME || "pn_admin";
  const c = await cookies();
  const v = c.get(cookieName)?.value;
  return v === "1";
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseServer();
  const body = await req.json().catch(() => ({}));
  const season_id = String(body?.season_id ?? "").trim();
  const is_published = Boolean(body?.is_published);

  if (!season_id) {
    return NextResponse.json({ error: "Missing season_id" }, { status: 400 });
  }

  const update = await sb.from("seasons").update({ is_published }).eq("id", season_id);
  if (update.error) {
    return NextResponse.json({ error: update.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, is_published });
}
