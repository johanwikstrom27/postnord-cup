import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const form = await req.formData();

  const season_id = String(form.get("season_id"));
  const name = String(form.get("name")).trim();
  const hcp = Number(String(form.get("hcp")).replace(",", "."));

  if (!season_id || !name || Number.isNaN(hcp)) {
    return NextResponse.redirect(new URL("/admin/players", req.url));
  }

  // 1) hitta eller skapa person
  const existing = await sb.from("people").select("id").eq("name", name).single();
  let personId = existing.data?.id as string | undefined;

  if (!personId) {
    const ins = await sb.from("people").insert({ name }).select("id").single();
    personId = ins.data?.id;
  }

  if (!personId) return NextResponse.redirect(new URL("/admin/players", req.url));

  // 2) koppla till säsong
  await sb.from("season_players").upsert(
    { season_id, person_id: personId, hcp },
    { onConflict: "season_id,person_id" }
  );

  return NextResponse.redirect(new URL("/admin/players", req.url));
}