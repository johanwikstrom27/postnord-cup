export const runtime = "nodejs";

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";

type SeasonRow = { id: string; name: string; created_at: string };
type RulesRow = {
  season_id: string;
  vanlig_best_of: number;
  major_best_of: number;
  lagtavling_best_of: number;
  hcp_zero_max: number | null;
  hcp_two_max: number | null;
  hcp_four_min: number | null;
};

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
    .select("season_id,vanlig_best_of,major_best_of,lagtavling_best_of,hcp_zero_max,hcp_two_max,hcp_four_min")
    .eq("season_id", season.id)
    .single();

  const rules = (rulesResp.data as RulesRow | null) ?? null;

  const vanlig = rules?.vanlig_best_of ?? 4;
  const major = rules?.major_best_of ?? 3;
  const lag = rules?.lagtavling_best_of ?? 2;

  const h0 = Number(rules?.hcp_zero_max ?? 10.5);
  const h2 = Number(rules?.hcp_two_max ?? 15.5);
  const h4 = Number(rules?.hcp_four_min ?? 15.6);

  return (
    <main className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-sm text-white/60">Admin</div>
          <h1 className="text-2xl font-semibold">Regler</h1>
          <div className="text-sm text-white/60">{season.name}</div>
        </div>
        <Link href={`/admin${seasonQuery}`} className="text-sm text-white/70 hover:underline">
          ← Resultat
        </Link>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Säsongsregler</h2>
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

          <button className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-semibold hover:bg-white/10">
            Spara regler
          </button>
        </form>
      </section>
    </main>
  );
}