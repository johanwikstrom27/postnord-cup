import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const form = await req.formData();

  const season_id = String(form.get("season_id") ?? "");
  const name = String(form.get("name") ?? "").trim();

  if (season_id && name) {
    await sb.from("seasons").update({ name }).eq("id", season_id);
  }

  return NextResponse.redirect(new URL("/admin/seasons", req.url));
}