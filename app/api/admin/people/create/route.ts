import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const form = await req.formData();

  const season = String(form.get("season") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const avatar_url_raw = String(form.get("avatar_url") ?? "").trim();
  const avatar_url = avatar_url_raw === "" ? null : avatar_url_raw;
  const back = season ? `/admin/people?season=${encodeURIComponent(season)}` : "/admin/people";

  if (!name) return NextResponse.redirect(new URL(back, req.url));

  await sb.from("people").insert({ name, avatar_url });
  return NextResponse.redirect(new URL(back, req.url));
}
