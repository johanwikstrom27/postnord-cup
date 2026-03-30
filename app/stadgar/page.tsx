export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { supabaseServer } from "@/lib/supabase";
import { resolvePublicSeason } from "@/lib/publicSeason";
import {
  DEFAULT_FINAL_START_SCORES,
  DEFAULT_STADGAR_CONTENT,
  interpolateTemplate,
  parseBulletList,
  parseParagraphs,
  type StadgarContentFields,
} from "@/lib/stadgarContent";

type RulesRow = {
  vanlig_best_of: number | null;
  major_best_of: number | null;
  lagtavling_best_of: number | null;
  hcp_zero_max?: number | null;
  hcp_two_max?: number | null;
  hcp_four_min?: number | null;
  final_start_scores?: number[] | null;
} & StadgarContentFields;

type SPRow = {
  id: string;
  person_id: string;
  hcp: number;
  people: { name: string; avatar_url: string | null } | null;
};

type SPJoinRow = {
  id: string;
  person_id: string;
  hcp: number;
  people:
    | { name: string; avatar_url: string | null }
    | Array<{ name: string; avatar_url: string | null }>
    | null;
};

type PointsRow = {
  event_type: string;
  placering: number;
  poang: number;
};

function fmtInt(n: number) {
  return n.toLocaleString("sv-SE");
}

function pnHcpSlag(hcp: number, hcpZeroMax: number, hcpTwoMax: number, hcpFourMin: number) {
  if (hcp <= hcpZeroMax) return 0;
  if (hcp < hcpFourMin && hcp <= hcpTwoMax) return 2;
  return 4;
}

function pointsFallback(eventType: string): { placing: number; points: number }[] {
  if (eventType === "VANLIG") {
    return [
      { placing: 1, points: 2000 },
      { placing: 2, points: 1200 },
      { placing: 3, points: 760 },
      { placing: 4, points: 540 },
      { placing: 5, points: 440 },
      { placing: 6, points: 400 },
      { placing: 7, points: 360 },
      { placing: 8, points: 340 },
      { placing: 9, points: 320 },
      { placing: 10, points: 300 },
      { placing: 11, points: 280 },
      { placing: 12, points: 260 },
    ];
  }
  if (eventType === "MAJOR") {
    return [
      { placing: 1, points: 4000 },
      { placing: 2, points: 2400 },
      { placing: 3, points: 1520 },
      { placing: 4, points: 1080 },
      { placing: 5, points: 880 },
      { placing: 6, points: 800 },
      { placing: 7, points: 720 },
      { placing: 8, points: 680 },
      { placing: 9, points: 640 },
      { placing: 10, points: 600 },
      { placing: 11, points: 560 },
      { placing: 12, points: 520 },
    ];
  }
  // Lagtävling (2v2) – topp 6
  return [
    { placing: 1, points: 2000 },
    { placing: 2, points: 1200 },
    { placing: 3, points: 760 },
    { placing: 4, points: 540 },
    { placing: 5, points: 440 },
    { placing: 6, points: 400 },
  ];
}

function textValue(value: string | null | undefined, fallback: string) {
  return value ?? fallback;
}

function formatSigned(n: number) {
  return n.toLocaleString("sv-SE");
}

export default async function StadgarPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const sb = supabaseServer();
  const sp = await searchParams;
  const season = await resolvePublicSeason(sb, sp?.season ?? null);
  if (!season) return <div className="text-white/70">Ingen säsong hittades.</div>;

  // Regler (best-of + HCP-gränser)
  const rulesResp = await sb
    .from("season_rules")
    .select(`
      vanlig_best_of,
      major_best_of,
      lagtavling_best_of,
      hcp_zero_max,
      hcp_two_max,
      hcp_four_min,
      final_start_scores,
      stadgar_header_description,
      stadgar_general_title,
      stadgar_general_items,
      stadgar_trackman_title,
      stadgar_trackman_items,
      stadgar_extra_title,
      stadgar_extra_body,
      stadgar_hcp_title,
      stadgar_hcp_intro,
      stadgar_final_title,
      stadgar_final_intro,
      stadgar_points_title,
      stadgar_points_intro,
      stadgar_regular_points_title,
      stadgar_major_points_title,
      stadgar_team_points_title,
      stadgar_team_points_note
    `)
    .eq("season_id", season.id)
    .single();

  const rules = (rulesResp.data as RulesRow | null) ?? null;

  const vanligBest = Number(rules?.vanlig_best_of ?? 4);
  const majorBest = Number(rules?.major_best_of ?? 3);
  const lagBest = Number(rules?.lagtavling_best_of ?? 2);

  const hcp0Max = Number(rules?.hcp_zero_max ?? 10.5);
  const hcp2Max = Number(rules?.hcp_two_max ?? 15.5);
  const hcp4Min = Number(rules?.hcp_four_min ?? 15.6);
  const finalStartScores = Array.isArray(rules?.final_start_scores)
    ? DEFAULT_FINAL_START_SCORES.map((fallback, index) => {
        const value = Number(rules?.final_start_scores?.[index]);
        return Number.isFinite(value) ? value : fallback;
      })
    : DEFAULT_FINAL_START_SCORES;
  const finalRows = finalStartScores.slice(0, 8).map((start, index) => ({ rank: index + 1, start }));
  const finalDefaultStart = finalStartScores[finalStartScores.length - 1] ?? 0;
  const templateValues = {
    vanlig_best_of: String(vanligBest),
    major_best_of: String(majorBest),
    lagtavling_best_of: String(lagBest),
    hcp_zero_max: hcp0Max.toFixed(1),
    hcp_zero_max_plus: (hcp0Max + 0.1).toFixed(1),
    hcp_two_max: hcp2Max.toFixed(1),
    hcp_four_min: hcp4Min.toFixed(1),
    final_rank_1: formatSigned(finalStartScores[0] ?? DEFAULT_FINAL_START_SCORES[0]),
    final_rank_1_with_two: formatSigned((finalStartScores[0] ?? DEFAULT_FINAL_START_SCORES[0]) - 2),
  };
  const content = {
    stadgar_header_description: textValue(rules?.stadgar_header_description, DEFAULT_STADGAR_CONTENT.stadgar_header_description),
    stadgar_general_title: textValue(rules?.stadgar_general_title, DEFAULT_STADGAR_CONTENT.stadgar_general_title),
    stadgar_general_items: textValue(rules?.stadgar_general_items, DEFAULT_STADGAR_CONTENT.stadgar_general_items),
    stadgar_trackman_title: textValue(rules?.stadgar_trackman_title, DEFAULT_STADGAR_CONTENT.stadgar_trackman_title),
    stadgar_trackman_items: textValue(rules?.stadgar_trackman_items, DEFAULT_STADGAR_CONTENT.stadgar_trackman_items),
    stadgar_extra_title: textValue(rules?.stadgar_extra_title, DEFAULT_STADGAR_CONTENT.stadgar_extra_title),
    stadgar_extra_body: textValue(rules?.stadgar_extra_body, DEFAULT_STADGAR_CONTENT.stadgar_extra_body),
    stadgar_hcp_title: textValue(rules?.stadgar_hcp_title, DEFAULT_STADGAR_CONTENT.stadgar_hcp_title),
    stadgar_hcp_intro: textValue(rules?.stadgar_hcp_intro, DEFAULT_STADGAR_CONTENT.stadgar_hcp_intro),
    stadgar_final_title: textValue(rules?.stadgar_final_title, DEFAULT_STADGAR_CONTENT.stadgar_final_title),
    stadgar_final_intro: textValue(rules?.stadgar_final_intro, DEFAULT_STADGAR_CONTENT.stadgar_final_intro),
    stadgar_points_title: textValue(rules?.stadgar_points_title, DEFAULT_STADGAR_CONTENT.stadgar_points_title),
    stadgar_points_intro: textValue(rules?.stadgar_points_intro, DEFAULT_STADGAR_CONTENT.stadgar_points_intro),
    stadgar_regular_points_title: textValue(
      rules?.stadgar_regular_points_title,
      DEFAULT_STADGAR_CONTENT.stadgar_regular_points_title
    ),
    stadgar_major_points_title: textValue(rules?.stadgar_major_points_title, DEFAULT_STADGAR_CONTENT.stadgar_major_points_title),
    stadgar_team_points_title: textValue(rules?.stadgar_team_points_title, DEFAULT_STADGAR_CONTENT.stadgar_team_points_title),
    stadgar_team_points_note: textValue(rules?.stadgar_team_points_note, DEFAULT_STADGAR_CONTENT.stadgar_team_points_note),
  } satisfies Record<keyof StadgarContentFields, string>;
  const headerParagraphs = parseParagraphs(interpolateTemplate(content.stadgar_header_description, templateValues));
  const generalItems = parseBulletList(interpolateTemplate(content.stadgar_general_items, templateValues));
  const trackmanItems = parseBulletList(interpolateTemplate(content.stadgar_trackman_items, templateValues));
  const hcpIntroParagraphs = parseParagraphs(interpolateTemplate(content.stadgar_hcp_intro, templateValues));
  const finalIntroParagraphs = parseParagraphs(interpolateTemplate(content.stadgar_final_intro, templateValues));
  const pointsIntroParagraphs = parseParagraphs(interpolateTemplate(content.stadgar_points_intro, templateValues));
  const extraParagraphs = parseParagraphs(interpolateTemplate(content.stadgar_extra_body, templateValues));

  // Spelare
  const spResp = await sb
    .from("season_players")
    .select("id,person_id,hcp,people(name,avatar_url)")
    .eq("season_id", season.id)
    .order("hcp", { ascending: true });

  const players = ((spResp.data ?? []) as unknown as SPJoinRow[]).map((p) => ({
    id: String(p.id),
    person_id: String(p.person_id),
    hcp: Number(p.hcp ?? 0),
    people: Array.isArray(p.people) ? p.people[0] ?? null : p.people ?? null,
  })) as SPRow[];

  // Poängtabell (DB eller fallback)
  const ptResp = await sb
    .from("points_table")
    .select("event_type,placering,poang")
    .eq("season_id", season.id)
    .order("event_type", { ascending: true })
    .order("placering", { ascending: true });

  const pointsRows = (ptResp.data as PointsRow[] | null) ?? [];

  const pointsFor = (eventType: "VANLIG" | "MAJOR" | "LAGTÄVLING") => {
    const fromDb = pointsRows
      .filter((r) => r.event_type === eventType)
      .map((r) => ({ placing: Number(r.placering), points: Number(r.poang) }))
      .sort((a, b) => a.placing - b.placing);

    return fromDb.length ? fromDb : pointsFallback(eventType);
  };

  const regularPoints = pointsFor("VANLIG");
  const majorPoints = pointsFor("MAJOR");
  const teamPoints = pointsFor("LAGTÄVLING");

  return (
    <main className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="text-sm text-white/60">Stadgar</div>
        <h1 className="mt-1 text-3xl sm:text-4xl font-semibold tracking-tight">{season.name}</h1>
        <div className="mt-2 space-y-2 text-white/60">
          {headerParagraphs.map((paragraph, index) => (
            <p key={`header-${index}`}>{paragraph}</p>
          ))}
        </div>
      </section>

      {/* Stadgar */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        {content.stadgar_general_title ? <h2 className="text-xl font-semibold">{content.stadgar_general_title}</h2> : null}
        {generalItems.length ? (
          <ul className="mt-3 space-y-2 text-white/80 list-disc pl-5">
            {generalItems.map((item, index) => (
              <li key={`general-${index}`}>{item}</li>
            ))}
          </ul>
        ) : null}

        {content.stadgar_trackman_title ? <h3 className="mt-6 text-lg font-semibold">{content.stadgar_trackman_title}</h3> : null}
        {trackmanItems.length ? (
          <ul className="mt-3 space-y-2 text-white/80 list-disc pl-5">
            {trackmanItems.map((item, index) => (
              <li key={`trackman-${index}`}>{item}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {content.stadgar_extra_title || extraParagraphs.length ? (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          {content.stadgar_extra_title ? <h2 className="text-xl font-semibold">{content.stadgar_extra_title}</h2> : null}
          <div className="mt-3 space-y-3 text-white/80">
            {extraParagraphs.map((paragraph, index) => (
              <p key={`extra-${index}`}>{paragraph}</p>
            ))}
          </div>
        </section>
      ) : null}

      {/* Spelare & PN-HCP */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        {content.stadgar_hcp_title ? <h2 className="text-xl font-semibold">{content.stadgar_hcp_title}</h2> : null}
        <div className="mt-2 space-y-2 text-sm text-white/60">
          {hcpIntroParagraphs.map((paragraph, index) => (
            <p key={`hcp-${index}`}>{paragraph}</p>
          ))}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-white/60">
              <tr className="border-b border-white/10">
                <th className="px-3 py-2 text-left">Spelare</th>
                <th className="px-3 py-2 text-right">HCP</th>
                <th className="px-3 py-2 text-right">PN-HCP (slag)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {players.map((p) => {
                const name = p.people?.name ?? "Okänd";
                const slag = pnHcpSlag(p.hcp, hcp0Max, hcp2Max, hcp4Min);
                return (
                  <tr key={p.person_id}>
                    <td className="px-3 py-2">{name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.hcp.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{slag}</td>
                  </tr>
                );
              })}
              {!players.length && (
                <tr>
                  <td className="px-3 py-4 text-white/60" colSpan={3}>
                    Inga spelare hittades för säsongen.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Final startscore */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        {content.stadgar_final_title ? <h2 className="text-xl font-semibold">{content.stadgar_final_title}</h2> : null}
        <div className="mt-2 space-y-2 text-sm text-white/60">
          {finalIntroParagraphs.map((paragraph, index) => (
            <p key={`final-${index}`}>{paragraph}</p>
          ))}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-white/60">
              <tr className="border-b border-white/10">
                <th className="px-3 py-2 text-left">Serieplacering</th>
                <th className="px-3 py-2 text-right">Startscore (slag)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {finalRows.map((r) => (
                <tr key={r.rank}>
                  <td className="px-3 py-2">#{r.rank}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.start}</td>
                </tr>
              ))}
              <tr>
                <td className="px-3 py-2">#9–#12</td>
                <td className="px-3 py-2 text-right tabular-nums">{finalDefaultStart}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Poängfördelning */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        {content.stadgar_points_title ? <h2 className="text-xl font-semibold">{content.stadgar_points_title}</h2> : null}
        <div className="mt-2 space-y-2 text-sm text-white/60">
          {pointsIntroParagraphs.map((paragraph, index) => (
            <p key={`points-${index}`}>{paragraph}</p>
          ))}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {/* Vanlig */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="font-semibold">{content.stadgar_regular_points_title}</div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-white/60">
                  <tr className="border-b border-white/10">
                    <th className="py-2 text-left">Placering</th>
                    <th className="py-2 text-right">Poäng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {regularPoints.map((r) => (
                    <tr key={r.placing}>
                      <td className="py-2">#{r.placing}</td>
                      <td className="py-2 text-right tabular-nums">{fmtInt(r.points)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Major */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="font-semibold">{content.stadgar_major_points_title}</div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-white/60">
                  <tr className="border-b border-white/10">
                    <th className="py-2 text-left">Placering</th>
                    <th className="py-2 text-right">Poäng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {majorPoints.map((r) => (
                    <tr key={r.placing}>
                      <td className="py-2">#{r.placing}</td>
                      <td className="py-2 text-right tabular-nums">{fmtInt(r.points)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Lagtävling */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="font-semibold">{content.stadgar_team_points_title}</div>
            {content.stadgar_team_points_note ? <div className="mt-1 text-xs text-white/60">{content.stadgar_team_points_note}</div> : null}
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-white/60">
                  <tr className="border-b border-white/10">
                    <th className="py-2 text-left">Placering</th>
                    <th className="py-2 text-right">Poäng / spelare</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {teamPoints.map((r) => (
                    <tr key={r.placing}>
                      <td className="py-2">#{r.placing}</td>
                      <td className="py-2 text-right tabular-nums">{fmtInt(r.points)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
