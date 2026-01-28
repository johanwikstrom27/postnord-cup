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

  if (!season_id) {
    return NextResponse.json({ error: "Missing season_id" }, { status: 400 });
  }

  // Sätt alla false (med where så Postgres inte gnäller)
  const off = await sb
    .from("seasons")
    .update({ is_current: false })
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (off.error) {
    return NextResponse.json({ error: off.error.message }, { status: 500 });
  }

  // Sätt vald true
  const on = await sb.from("seasons").update({ is_current: true }).eq("id", season_id);
  if (on.error) {
    return NextResponse.json({ error: on.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}