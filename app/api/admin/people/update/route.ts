import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const form = await req.formData();

  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const avatar_url_raw = String(form.get("avatar_url") ?? "").trim();
  const avatar_url = avatar_url_raw === "" ? null : avatar_url_raw;

  const bio = String(form.get("bio") ?? "").trim() || null;
  const fun_facts = String(form.get("fun_facts") ?? "").trim() || null;
  const strengths = String(form.get("strengths") ?? "").trim() || null;
  const weaknesses = String(form.get("weaknesses") ?? "").trim() || null;

  if (!id || !name) return NextResponse.redirect(new URL("/admin/people", req.url));

  await sb.from("people").update({ name, avatar_url, bio, fun_facts, strengths, weaknesses }).eq("id", id);
  return NextResponse.redirect(new URL(`/admin/people/${id}`, req.url));
}