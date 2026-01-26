import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const form = await req.formData();

  const season_player_id = String(form.get("season_player_id") ?? "");
  const season_id = String(form.get("season_id") ?? "");

  if (season_player_id) {
    await sb
      .from("season_players")
      .delete()
      .eq("id", season_player_id);
  }

  // Redirect tillbaka till rätt säsong i admin
  const backUrl = season_id
    ? `/admin/players?season=${encodeURIComponent(season_id)}`
    : "/admin/players";

  return NextResponse.redirect(new URL(backUrl, req.url));
}