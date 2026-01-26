import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const form = await req.formData();

  const season_id = String(form.get("season_id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const event_type = String(form.get("event_type") ?? "VANLIG");

  const starts_at_local = String(form.get("starts_at_local") ?? "");
  const starts_at = starts_at_local ? new Date(starts_at_local).toISOString() : null;

  const course = String(form.get("course") ?? "").trim() || null;
  const description = String(form.get("description") ?? "").trim() || null;
  const image_url = String(form.get("image_url") ?? "").trim() || null;
  const setting_wind = String(form.get("setting_wind") ?? "").trim() || null;

  const teeRaw = String(form.get("setting_tee_meters") ?? "").trim();
  const setting_tee_meters = teeRaw === "" ? null : Number(teeRaw);

  const setting_pins = String(form.get("setting_pins") ?? "").trim() || null;

  if (!season_id || !name || !starts_at) {
    return NextResponse.redirect(new URL(`/admin/events/new?season=${encodeURIComponent(season_id)}`, req.url));
  }

  const ins = await sb.from("events").insert({
    season_id,
    name,
    event_type,
    starts_at,
    course,
    description,
    image_url,
    setting_wind,
    setting_tee_meters: Number.isNaN(setting_tee_meters) ? null : setting_tee_meters,
    setting_pins,
    locked: false,
  }).select("id").single();

  const newId = ins.data?.id as string | undefined;

  // tillbaka till tävlingslistan för samma säsong
  const back = `/admin/events?season=${encodeURIComponent(season_id)}`;
  if (!newId) return NextResponse.redirect(new URL(back, req.url));

  return NextResponse.redirect(new URL(`/admin/events/${newId}?season=${encodeURIComponent(season_id)}`, req.url));
}