import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const form = await req.formData();
  const event_id = String(form.get("event_id"));

  if (event_id) {
    await sb.from("events").delete().eq("id", event_id);
  }

  return NextResponse.redirect(new URL("/admin/events", req.url));
}