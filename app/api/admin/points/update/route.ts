import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const form = await req.formData();

  const season_id = String(form.get("season_id") ?? "");
  const event_type = String(form.get("event_type") ?? "");

  if (!season_id || !event_type) {
    return NextResponse.redirect(new URL("/admin/points", req.url));
  }

  // Vi vet inte exakt hur många placeringar som finns, så vi läser alla keys poang_X
  const updates: Array<{ season_id: string; event_type: string; placering: number; poang: number }> = [];

  for (const [key, value] of form.entries()) {
    if (!key.startsWith("poang_")) continue;
    const placingStr = key.replace("poang_", "");
    const placering = Number(placingStr);
    const poang = Number(value);

    if (!Number.isNaN(placering) && !Number.isNaN(poang)) {
      updates.push({ season_id, event_type, placering, poang });
    }
  }

  if (updates.length) {
    await sb.from("points_table").upsert(updates, {
      onConflict: "season_id,event_type,placering",
    });
  }

  return NextResponse.redirect(new URL(`/admin/points?season=${encodeURIComponent(season_id)}`, req.url));
}