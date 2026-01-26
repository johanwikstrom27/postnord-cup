import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const form = await req.formData();

  const season_id = String(form.get("season_id") ?? "");
  const person_id = String(form.get("person_id") ?? "");
  const hcpRaw = String(form.get("hcp") ?? "").trim().replace(",", ".");
  const hcp = Number(hcpRaw);

  if (!season_id || !person_id || Number.isNaN(hcp)) {
    return NextResponse.redirect(new URL(`/admin/players?season=${encodeURIComponent(season_id)}`, req.url));
  }

  // Upsert för att undvika dubletter om man redan lagt till
  await sb.from("season_players").upsert(
    { season_id, person_id, hcp },
    { onConflict: "season_id,person_id" }
  );

  return NextResponse.redirect(new URL(`/admin/players?season=${encodeURIComponent(season_id)}`, req.url));
}