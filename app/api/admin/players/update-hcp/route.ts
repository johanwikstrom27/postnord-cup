import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const form = await req.formData();

  const season_player_id = String(form.get("season_player_id") ?? "");
  const season_id = String(form.get("season_id") ?? "");
  const hcpRaw = String(form.get("hcp") ?? "").trim().replace(",", ".");

  const hcp = Number(hcpRaw);

  if (season_player_id && !Number.isNaN(hcp)) {
    await sb.from("season_players").update({ hcp }).eq("id", season_player_id);
  }

  // Tillbaka till samma säsong i admin
  const back = season_id ? `/admin/players?season=${encodeURIComponent(season_id)}` : "/admin/players";
  return NextResponse.redirect(new URL(back, req.url));
}