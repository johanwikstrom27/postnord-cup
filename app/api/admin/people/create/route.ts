import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const form = await req.formData();

  const name = String(form.get("name") ?? "").trim();
  const avatar_url_raw = String(form.get("avatar_url") ?? "").trim();
  const avatar_url = avatar_url_raw === "" ? null : avatar_url_raw;

  if (!name) return NextResponse.redirect(new URL("/admin/people", req.url));

  await sb.from("people").insert({ name, avatar_url });
  return NextResponse.redirect(new URL("/admin/people", req.url));
}