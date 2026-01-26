import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const form = await req.formData();
  const season_id = String(form.get("season_id") ?? "");

  if (!season_id) return NextResponse.redirect(new URL("/admin/seasons", req.url));

  // Sätt alla andra false (säkert med WHERE)
  await sb.from("seasons").update({ is_current: false }).neq("id", season_id);

  // Sätt vald true
  await sb.from("seasons").update({ is_current: true }).eq("id", season_id);

  return NextResponse.redirect(new URL("/admin/seasons", req.url));
}