import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const form = await req.formData();

  const season_id = String(form.get("season_id") ?? "");
  if (!season_id) return NextResponse.redirect(new URL("/admin/players", req.url));

  // 1) Hämta alla säsonger (nyast först)
  const seasonsResp = await sb
    .from("seasons")
    .select("id,created_at")
    .order("created_at", { ascending: false });

  const seasons = (seasonsResp.data ?? []) as Array<{ id: string; created_at: string }>;

  const idx = seasons.findIndex((s) => s.id === season_id);
  const prevSeason = idx >= 0 ? seasons[idx + 1] : null; // nästa i listan = “förra”

  if (!prevSeason) {
    // Ingen förra säsong att kopiera från
    return NextResponse.redirect(
      new URL(`/admin/players?season=${encodeURIComponent(season_id)}`, req.url)
    );
  }

  // 2) Hämta truppen från förra säsongen
  const prevResp = await sb
    .from("season_players")
    .select("person_id,hcp")
    .eq("season_id", prevSeason.id);

  const prevRows = (prevResp.data ?? []) as Array<{ person_id: string; hcp: number }>;

  if (!prevRows.length) {
    return NextResponse.redirect(
      new URL(`/admin/players?season=${encodeURIComponent(season_id)}`, req.url)
    );
  }

  // 3) Hämta redan existerande person_ids i nuvarande säsong
  const curResp = await sb
    .from("season_players")
    .select("person_id")
    .eq("season_id", season_id);

  const existing = new Set((curResp.data ?? []).map((r: any) => r.person_id as string));

  // 4) Insert endast saknade (skriver inte över befintliga HCP)
  const toInsert = prevRows
    .filter((r) => !existing.has(r.person_id))
    .map((r) => ({
      season_id,
      person_id: r.person_id,
      hcp: r.hcp,
    }));

  if (toInsert.length) {
    await sb.from("season_players").insert(toInsert);
  }

  return NextResponse.redirect(
    new URL(`/admin/players?season=${encodeURIComponent(season_id)}`, req.url)
  );
}