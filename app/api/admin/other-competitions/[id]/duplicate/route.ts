import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { normalizeCompetitionRow, normalizeSlug } from "@/lib/otherCompetitions/data";

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = supabaseServer();

  const resp = await sb.from("other_competitions").select("*").eq("id", id).single();
  if (resp.error || !resp.data) {
    return NextResponse.redirect(new URL("/admin/other-competitions?error=missing", req.url));
  }

  const source = normalizeCompetitionRow(resp.data as Record<string, unknown>);
  const name = `${source.name} kopia`;
  const slug = `${normalizeSlug(name)}-${String(Date.now()).slice(-5)}`;
  const config = {
    ...source.config,
    rounds: source.config.rounds.map((round, index) => ({ ...round, sortOrder: index })),
    results: {},
    finalPlacementOverrides: {},
  };

  const insertResp = await sb
    .from("other_competitions")
    .insert({
      name,
      slug,
      subtitle: source.subtitle,
      location: source.location,
      starts_on: source.starts_on,
      ends_on: source.ends_on,
      status: "draft",
      card_image_url: source.card_image_url,
      header_image_url: source.header_image_url,
      rules_content: source.rules_content,
      config,
    })
    .select("id")
    .single();

  const newId = insertResp.data?.id as string | undefined;
  if (!newId) return NextResponse.redirect(new URL("/admin/other-competitions?error=duplicate", req.url));
  return NextResponse.redirect(new URL(`/admin/other-competitions/${newId}`, req.url));
}
