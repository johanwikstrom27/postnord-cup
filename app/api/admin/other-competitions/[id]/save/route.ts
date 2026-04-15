import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import {
  normalizeCompetitionRow,
  normalizeConfig,
  normalizeSlug,
} from "@/lib/otherCompetitions/data";
import type { OtherCompetitionStatus } from "@/lib/otherCompetitions/types";

export const runtime = "nodejs";

type Payload = {
  competition?: {
    name?: unknown;
    slug?: unknown;
    subtitle?: unknown;
    location?: unknown;
    starts_on?: unknown;
    ends_on?: unknown;
    status?: unknown;
    card_image_url?: unknown;
    header_image_url?: unknown;
    rules_content?: unknown;
  };
  config?: unknown;
};

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function cleanDate(value: unknown) {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function cleanStatus(value: unknown): OtherCompetitionStatus {
  if (value === "published" || value === "live" || value === "locked") return value;
  return "draft";
}

export async function POST(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = supabaseServer();
  const body = (await req.json()) as Payload;

  const existingResp = await sb.from("other_competitions").select("*").eq("id", id).single();
  if (existingResp.error || !existingResp.data) {
    return NextResponse.json({ error: "Tävlingen hittades inte." }, { status: 404 });
  }

  const existing = normalizeCompetitionRow(existingResp.data as Record<string, unknown>);
  const nextStatus = cleanStatus(body.competition?.status ?? existing.status);

  if (existing.status === "locked" && nextStatus === "locked") {
    return NextResponse.json(
      { error: "Tävlingen är låst. Lås upp den innan ändringar sparas." },
      { status: 423 }
    );
  }

  const nextName = cleanText(body.competition?.name) ?? existing.name;
  const nextSlug = normalizeSlug(String(body.competition?.slug ?? existing.slug));
  const patch = {
    name: nextName,
    slug: nextSlug,
    subtitle: cleanText(body.competition?.subtitle),
    location: cleanText(body.competition?.location),
    starts_on: cleanDate(body.competition?.starts_on),
    ends_on: cleanDate(body.competition?.ends_on),
    status: nextStatus,
    card_image_url: cleanText(body.competition?.card_image_url),
    header_image_url: cleanText(body.competition?.header_image_url),
    rules_content: String(body.competition?.rules_content ?? ""),
    config: normalizeConfig(body.config),
  };

  const updateResp = await sb.from("other_competitions").update(patch).eq("id", id).select("*").single();
  if (updateResp.error || !updateResp.data) {
    const message = updateResp.error?.code === "23505" ? "Sluggen används redan av en annan tävling." : updateResp.error?.message;
    return NextResponse.json({ error: message ?? "Kunde inte spara." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, competition: normalizeCompetitionRow(updateResp.data as Record<string, unknown>) });
}
