import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const form = await req.formData();

  const season_id = String(form.get("season_id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const avatar_url_raw = String(form.get("avatar_url") ?? "").trim();
  const avatar_url = avatar_url_raw === "" ? null : avatar_url_raw;

  const hcpRaw = String(form.get("hcp") ?? "").trim().replace(",", ".");
  const hcp = Number(hcpRaw);

  if (!season_id || !name || Number.isNaN(hcp)) {
    return NextResponse.redirect(new URL(`/admin/players?season=${encodeURIComponent(season_id)}`, req.url));
  }

  // Skapa person (people)
  const ins = await sb.from("people").insert({ name, avatar_url }).select("id").single();
  const person_id = ins.data?.id as string | undefined;

  if (!person_id) {
    return NextResponse.redirect(new URL(`/admin/players?season=${encodeURIComponent(season_id)}`, req.url));
  }

  // Koppla till säsong med HCP
  await sb.from("season_players").insert({ season_id, person_id, hcp });

  return NextResponse.redirect(new URL(`/admin/players?season=${encodeURIComponent(season_id)}`, req.url));
}