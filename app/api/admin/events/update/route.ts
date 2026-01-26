import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const form = await req.formData();

  const event_id = String(form.get("event_id") ?? "");
  if (!event_id) return NextResponse.redirect(new URL("/admin/events", req.url));

  const name = String(form.get("name") ?? "");
  const event_type = String(form.get("event_type") ?? "VANLIG");

  const starts_at_local = String(form.get("starts_at_local") ?? "");
  // datetime-local -> ISO (UTC)
  const starts_at = starts_at_local ? new Date(starts_at_local).toISOString() : null;

  const course = String(form.get("course") ?? "").trim() || null;
  const image_url = String(form.get("image_url") ?? "").trim() || null;
  const setting_wind = String(form.get("setting_wind") ?? "").trim() || null;

  const teeRaw = String(form.get("setting_tee_meters") ?? "").trim();
  const setting_tee_meters = teeRaw === "" ? null : Number(teeRaw);

  const setting_pins = String(form.get("setting_pins") ?? "").trim() || null;
  const description = String(form.get("description") ?? "").trim() || null;

  const locked = form.get("locked") === "on";

  const patch: any = {
    name,
    event_type,
    course,
    image_url,
    setting_wind,
    setting_tee_meters: Number.isNaN(setting_tee_meters) ? null : setting_tee_meters,
    setting_pins,
    description,
    locked,
  };

  if (starts_at) patch.starts_at = starts_at;

  await sb.from("events").update(patch).eq("id", event_id);

  return NextResponse.redirect(new URL(`/admin/events/${event_id}/edit`, req.url));
}