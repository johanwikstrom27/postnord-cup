export const runtime = "nodejs";

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";
import { DEFAULT_STADGAR_CONTENT, STADGAR_TEMPLATE_TOKENS, type StadgarContentFields } from "@/lib/stadgarContent";

type SeasonRow = { id: string; name: string; created_at: string };
type RulesRow = {
  season_id: string;
  vanlig_best_of: number;
  major_best_of: number;
  lagtavling_best_of: number;
  hcp_zero_max: number | null;
  hcp_two_max: number | null;
  hcp_four_min: number | null;
} & StadgarContentFields;

function rulesTextValue(value: string | null | undefined, fallback: string) {
  return value ?? fallback;
}

async function resolveSeason(sb: ReturnType<typeof supabaseServer>, requestedSeasonId: string | null) {
  if (requestedSeasonId) {
    const r = await sb.from("seasons").select("id,name,created_at").eq("id", requestedSeasonId).single();
    const s = (r.data as SeasonRow | null) ?? null;
    if (s) return s;
  }

  const cur = await sb.from("seasons").select("id,name,created_at").eq("is_current", true).limit(1).single();
  let season = (cur.data as SeasonRow | null) ?? null;

  if (!season) {
    const latest = await sb.from("seasons").select("id,name,created_at").order("created_at", { ascending: false }).limit(1).single();
    season = (latest.data as SeasonRow | null) ?? null;
  }

  return season;
}

export default async function AdminRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const sb = supabaseServer();
  const sp = await searchParams;
  const requestedSeasonId = sp?.season ?? null;

  const season = await resolveSeason(sb, requestedSeasonId);
  if (!season) return <div className="text-white/70">Ingen säsong hittades.</div>;

  const seasonQuery = `?season=${encodeURIComponent(season.id)}`;

  // Hämta regler (om saknas: defaultvärden)
  const rulesResp = await sb
    .from("season_rules")
    .select(`
      season_id,
      vanlig_best_of,
      major_best_of,
      lagtavling_best_of,
      hcp_zero_max,
      hcp_two_max,
      hcp_four_min,
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

  const vanlig = rules?.vanlig_best_of ?? 4;
  const major = rules?.major_best_of ?? 3;
  const lag = rules?.lagtavling_best_of ?? 2;

  const h0 = Number(rules?.hcp_zero_max ?? 10.5);
  const h2 = Number(rules?.hcp_two_max ?? 15.5);
  const h4 = Number(rules?.hcp_four_min ?? 15.6);
  const content = {
    stadgar_header_description: rulesTextValue(rules?.stadgar_header_description, DEFAULT_STADGAR_CONTENT.stadgar_header_description),
    stadgar_general_title: rulesTextValue(rules?.stadgar_general_title, DEFAULT_STADGAR_CONTENT.stadgar_general_title),
    stadgar_general_items: rulesTextValue(rules?.stadgar_general_items, DEFAULT_STADGAR_CONTENT.stadgar_general_items),
    stadgar_trackman_title: rulesTextValue(rules?.stadgar_trackman_title, DEFAULT_STADGAR_CONTENT.stadgar_trackman_title),
    stadgar_trackman_items: rulesTextValue(rules?.stadgar_trackman_items, DEFAULT_STADGAR_CONTENT.stadgar_trackman_items),
    stadgar_extra_title: rulesTextValue(rules?.stadgar_extra_title, DEFAULT_STADGAR_CONTENT.stadgar_extra_title),
    stadgar_extra_body: rulesTextValue(rules?.stadgar_extra_body, DEFAULT_STADGAR_CONTENT.stadgar_extra_body),
    stadgar_hcp_title: rulesTextValue(rules?.stadgar_hcp_title, DEFAULT_STADGAR_CONTENT.stadgar_hcp_title),
    stadgar_hcp_intro: rulesTextValue(rules?.stadgar_hcp_intro, DEFAULT_STADGAR_CONTENT.stadgar_hcp_intro),
    stadgar_final_title: rulesTextValue(rules?.stadgar_final_title, DEFAULT_STADGAR_CONTENT.stadgar_final_title),
    stadgar_final_intro: rulesTextValue(rules?.stadgar_final_intro, DEFAULT_STADGAR_CONTENT.stadgar_final_intro),
    stadgar_points_title: rulesTextValue(rules?.stadgar_points_title, DEFAULT_STADGAR_CONTENT.stadgar_points_title),
    stadgar_points_intro: rulesTextValue(rules?.stadgar_points_intro, DEFAULT_STADGAR_CONTENT.stadgar_points_intro),
    stadgar_regular_points_title: rulesTextValue(
      rules?.stadgar_regular_points_title,
      DEFAULT_STADGAR_CONTENT.stadgar_regular_points_title
    ),
    stadgar_major_points_title: rulesTextValue(rules?.stadgar_major_points_title, DEFAULT_STADGAR_CONTENT.stadgar_major_points_title),
    stadgar_team_points_title: rulesTextValue(rules?.stadgar_team_points_title, DEFAULT_STADGAR_CONTENT.stadgar_team_points_title),
    stadgar_team_points_note: rulesTextValue(rules?.stadgar_team_points_note, DEFAULT_STADGAR_CONTENT.stadgar_team_points_note),
  } satisfies Record<keyof StadgarContentFields, string>;

  return (
    <main className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-sm text-white/60">Admin</div>
          <h1 className="text-2xl font-semibold">Regler & Stadgar</h1>
          <div className="text-sm text-white/60">{season.name}</div>
        </div>
        <Link href={`/admin${seasonQuery}`} className="text-sm text-white/70 hover:underline">
          ← Resultat
        </Link>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Säsongsregler & Stadgar-sida</h2>
            <p className="mt-1 text-sm text-white/60">
              Här styr du både numeriska regler och allt textinnehåll på publika sidan <code>/stadgar</code>.
            </p>
          </div>
          <Link
            href={`/stadgar${seasonQuery}`}
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Öppna publika stadgar →
          </Link>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-white/60">
          En regel per rad i listfälten. Tom rad i brödtext skapar nytt stycke. Stödda tokener:{" "}
          {STADGAR_TEMPLATE_TOKENS.join(", ")}.
        </div>

        <h3 className="mt-6 text-base font-semibold">Sifferregler</h3>
        <p className="mt-1 text-sm text-white/60">
          Här styr du best-of och HCP-gränser. Gränserna används för att räkna nettoslag (0/2/4 slag).
        </p>

        <form className="mt-6 space-y-6" method="POST" action="/api/admin/rules/save">
          <input type="hidden" name="season_id" value={season.id} />

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-xs text-white/60 mb-1">Vanlig: bästa X</div>
              <input
                name="vanlig_best_of"
                type="number"
                defaultValue={vanlig}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                min={0}
              />
            </div>

            <div>
              <div className="text-xs text-white/60 mb-1">Major: bästa X</div>
              <input
                name="major_best_of"
                type="number"
                defaultValue={major}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                min={0}
              />
            </div>

            <div>
              <div className="text-xs text-white/60 mb-1">Lagtävling: bästa X</div>
              <input
                name="lagtavling_best_of"
                type="number"
                defaultValue={lag}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                min={0}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-xs text-white/60 mb-1">HCP → 0 slag max</div>
              <input
                name="hcp_zero_max"
                defaultValue={String(h0)}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
              <div className="mt-1 text-xs text-white/50">Ex: 10.5 betyder 0–10.5 ⇒ 0 slag.</div>
            </div>

            <div>
              <div className="text-xs text-white/60 mb-1">HCP → 2 slag max</div>
              <input
                name="hcp_two_max"
                defaultValue={String(h2)}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
              <div className="mt-1 text-xs text-white/50">Ex: 15.5 betyder 10.6–15.5 ⇒ 2 slag.</div>
            </div>

            <div>
              <div className="text-xs text-white/60 mb-1">HCP → 4 slag från</div>
              <input
                name="hcp_four_min"
                defaultValue={String(h4)}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
              <div className="mt-1 text-xs text-white/50">Ex: 15.6 betyder 15.6+ ⇒ 4 slag.</div>
            </div>
          </div>

          <section className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-5">
            <h3 className="text-base font-semibold">Sidhuvud</h3>
            <div>
              <div className="mb-1 text-xs text-white/60">Ingress</div>
              <textarea
                name="stadgar_header_description"
                defaultValue={content.stadgar_header_description}
                className="min-h-[88px] w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-5">
            <h3 className="text-base font-semibold">Stadgar</h3>
            <div>
              <div className="mb-1 text-xs text-white/60">Rubrik</div>
              <input
                name="stadgar_general_title"
                defaultValue={content.stadgar_general_title}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
            </div>
            <div>
              <div className="mb-1 text-xs text-white/60">Punkter, en per rad</div>
              <textarea
                name="stadgar_general_items"
                defaultValue={content.stadgar_general_items}
                className="min-h-[220px] w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-5">
            <h3 className="text-base font-semibold">Trackmanregler</h3>
            <div>
              <div className="mb-1 text-xs text-white/60">Rubrik</div>
              <input
                name="stadgar_trackman_title"
                defaultValue={content.stadgar_trackman_title}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
            </div>
            <div>
              <div className="mb-1 text-xs text-white/60">Punkter, en per rad</div>
              <textarea
                name="stadgar_trackman_items"
                defaultValue={content.stadgar_trackman_items}
                className="min-h-[160px] w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-5">
            <h3 className="text-base font-semibold">Extra sektion</h3>
            <p className="text-sm text-white/60">Använd den här för fri text som prispott, avgifter eller specialregler.</p>
            <div>
              <div className="mb-1 text-xs text-white/60">Rubrik</div>
              <input
                name="stadgar_extra_title"
                defaultValue={content.stadgar_extra_title}
                placeholder="Ex: Prispott"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
            </div>
            <div>
              <div className="mb-1 text-xs text-white/60">Brödtext</div>
              <textarea
                name="stadgar_extra_body"
                defaultValue={content.stadgar_extra_body}
                placeholder="Skriv valfri tilläggstext här..."
                className="min-h-[140px] w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-5">
            <h3 className="text-base font-semibold">PN-HCP-sektion</h3>
            <div>
              <div className="mb-1 text-xs text-white/60">Rubrik</div>
              <input
                name="stadgar_hcp_title"
                defaultValue={content.stadgar_hcp_title}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
            </div>
            <div>
              <div className="mb-1 text-xs text-white/60">Ingress</div>
              <textarea
                name="stadgar_hcp_intro"
                defaultValue={content.stadgar_hcp_intro}
                className="min-h-[110px] w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-5">
            <h3 className="text-base font-semibold">Final-sektion</h3>
            <div>
              <div className="mb-1 text-xs text-white/60">Rubrik</div>
              <input
                name="stadgar_final_title"
                defaultValue={content.stadgar_final_title}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
            </div>
            <div>
              <div className="mb-1 text-xs text-white/60">Ingress</div>
              <textarea
                name="stadgar_final_intro"
                defaultValue={content.stadgar_final_intro}
                className="min-h-[110px] w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-5">
            <h3 className="text-base font-semibold">Poängfördelning</h3>
            <div>
              <div className="mb-1 text-xs text-white/60">Rubrik</div>
              <input
                name="stadgar_points_title"
                defaultValue={content.stadgar_points_title}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
            </div>
            <div>
              <div className="mb-1 text-xs text-white/60">Ingress</div>
              <textarea
                name="stadgar_points_intro"
                defaultValue={content.stadgar_points_intro}
                className="min-h-[120px] w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="mb-1 text-xs text-white/60">Rubrik: Vanlig</div>
                <input
                  name="stadgar_regular_points_title"
                  defaultValue={content.stadgar_regular_points_title}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                />
              </div>
              <div>
                <div className="mb-1 text-xs text-white/60">Rubrik: Major</div>
                <input
                  name="stadgar_major_points_title"
                  defaultValue={content.stadgar_major_points_title}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                />
              </div>
              <div>
                <div className="mb-1 text-xs text-white/60">Rubrik: Lagtävling</div>
                <input
                  name="stadgar_team_points_title"
                  defaultValue={content.stadgar_team_points_title}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                />
              </div>
            </div>

            <div>
              <div className="mb-1 text-xs text-white/60">Notis under lagtävlingstabellen</div>
              <input
                name="stadgar_team_points_note"
                defaultValue={content.stadgar_team_points_note}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
            </div>
          </section>

          <button className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-semibold hover:bg-white/10">
            Spara regler & stadgar
          </button>
        </form>
      </section>
    </main>
  );
}
