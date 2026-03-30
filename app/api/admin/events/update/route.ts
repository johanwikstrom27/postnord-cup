import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

type EventPatch = {
  name: string;
  course: string | null;
  image_url: string | null;
  setting_wind: string | null;
  setting_tee_meters: number | null;
  setting_pins: string | null;
  description: string | null;
  event_type?: string;
  starts_at?: string;
};

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
  const eventResp = await sb
    .from("events")
    .select("id,event_type")
    .eq("id", event_id)
    .single();

  if (eventResp.error || !eventResp.data) {
    return NextResponse.redirect(new URL("/admin/events", req.url));
  }

  const resultCountResp = await sb
    .from("results")
    .select("event_id", { count: "exact", head: true })
    .eq("event_id", event_id);
  const hasResults = Number(resultCountResp.count ?? 0) > 0;

  const patch: EventPatch = {
    name,
    course,
    image_url,
    setting_wind,
    setting_tee_meters: Number.isNaN(setting_tee_meters) ? null : setting_tee_meters,
    setting_pins,
    description,
  };

  if (!hasResults) {
    patch.event_type = event_type;
  }

  if (starts_at) patch.starts_at = starts_at;

  await sb.from("events").update(patch).eq("id", event_id);

  return NextResponse.redirect(new URL(`/admin/events/${event_id}/edit`, req.url));
}
