export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase";
import { normalizeCompetitionRow } from "@/lib/otherCompetitions/data";
import OtherCompetitionAdminEditor from "@/components/other-competitions/OtherCompetitionAdminEditor";
import type { PostNordPersonSnapshot } from "@/lib/otherCompetitions/types";

export default async function AdminOtherCompetitionEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = supabaseServer();

  const [competitionResp, peopleResp] = await Promise.all([
    sb.from("other_competitions").select("*").eq("id", id).single(),
    sb.from("people").select("id,name,avatar_url").order("name", { ascending: true }),
  ]);

  if (competitionResp.error || !competitionResp.data) notFound();

  const competition = normalizeCompetitionRow(competitionResp.data as Record<string, unknown>);
  const people = (peopleResp.data ?? []) as PostNordPersonSnapshot[];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <Link href="/admin/other-competitions" className="text-white/70 hover:text-white">
          Till Andra tävlingar
        </Link>
        {competition.status !== "draft" ? (
          <Link href={`/other-competitions/${competition.slug}`} className="text-white/70 hover:text-white">
            Visa publik sida
          </Link>
        ) : null}
      </div>
      <OtherCompetitionAdminEditor initialCompetition={competition} people={people} />
    </div>
  );
}
