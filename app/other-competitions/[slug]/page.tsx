export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase";
import { normalizeCompetitionRow } from "@/lib/otherCompetitions/data";
import OtherCompetitionPublicClient from "@/components/other-competitions/OtherCompetitionPublicClient";

export default async function OtherCompetitionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sb = supabaseServer();

  const resp = await sb
    .from("other_competitions")
    .select("*")
    .eq("slug", slug)
    .neq("status", "draft")
    .single();

  if (resp.error || !resp.data) notFound();

  return <OtherCompetitionPublicClient initialCompetition={normalizeCompetitionRow(resp.data as Record<string, unknown>)} />;
}
