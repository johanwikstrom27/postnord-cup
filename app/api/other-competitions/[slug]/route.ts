import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { normalizeCompetitionRow } from "@/lib/otherCompetitions/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, ctx: { params: { slug: string } | Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const sb = supabaseServer();

  const resp = await sb
    .from("other_competitions")
    .select("*")
    .eq("slug", slug)
    .neq("status", "draft")
    .single();

  if (resp.error || !resp.data) {
    return NextResponse.json({ error: "Tävlingen hittades inte." }, { status: 404 });
  }

  return NextResponse.json({ competition: normalizeCompetitionRow(resp.data as Record<string, unknown>) });
}
