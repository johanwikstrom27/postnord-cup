import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { EMPTY_OTHER_COMPETITION_CONFIG, normalizeSlug } from "@/lib/otherCompetitions/data";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const form = await req.formData();
  const name = String(form.get("name") ?? "Ny tävling").trim() || "Ny tävling";
  const startsOn = String(form.get("starts_on") ?? "").trim() || null;

  const baseSlug = normalizeSlug(name);
  const slug = `${baseSlug}-${String(Date.now()).slice(-5)}`;

  const resp = await sb
    .from("other_competitions")
    .insert({
      name,
      slug,
      starts_on: startsOn,
      status: "draft",
      config: EMPTY_OTHER_COMPETITION_CONFIG,
    })
    .select("id")
    .single();

  const id = resp.data?.id as string | undefined;
  if (!id) return NextResponse.redirect(new URL("/admin/other-competitions?error=create", req.url));

  return NextResponse.redirect(new URL(`/admin/other-competitions/${id}`, req.url));
}
