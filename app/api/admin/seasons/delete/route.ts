import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const form = await req.formData();

  const season_id = String(form.get("season_id") ?? "");
  if (!season_id) return NextResponse.redirect(new URL("/admin/seasons", req.url));

  // OBS: raderar bara seasons-raden. Om det finns FK-restriktioner kan detta faila.
  // I så fall får vi lägga in "cascade delete" via admin (valfritt).
  await sb.from("seasons").delete().eq("id", season_id);

  return NextResponse.redirect(new URL("/admin/seasons", req.url));
}