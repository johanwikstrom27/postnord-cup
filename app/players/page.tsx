export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";

type SeasonRow = { id: string; name: string; created_at: string; is_current?: boolean };

type PlayerRow = {
  person_id: string;
  name: string;
  avatar_url: string | null;
  hcp: number;
  total: number;
};

type RulesRow = { vanlig_best_of: number | null; major_best_of: number | null; lagtavling_best_of: number | null };

type ResultRow = {
  season_player_id: string;
  poang: number | null;
  did_not_play: boolean;
  events: { event_type: string; locked: boolean } | null;
};

function sumTopN(values: number[], n: number) {
  return values
    .slice()
    .sort((a, b) => b - a)
    .slice(0, n)
    .reduce((acc, v) => acc + v, 0);
}

function fmtInt(n: number) {
  return n.toLocaleString("sv-SE");
}

async function resolveSeason(sb: ReturnType<typeof supabaseServer>, requestedSeasonId: string | null) {
  if (requestedSeasonId) {
    const r = await sb.from("seasons").select("id,name,created_at,is_current").eq("id", requestedSeasonId).single();
    if (r.data) return r.data as SeasonRow;
  }

  const cur = await sb.from("seasons").select("id,name,created_at,is_current").eq("is_current", true).limit(1).single();
  if (cur.data) return cur.data as SeasonRow;

  const latest = await sb.from("seasons").select("id,name,created_at,is_current").order("created_at", { ascending: false }).limit(1).single();
  return (latest.data as SeasonRow) ?? null;
}

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const sb = supabaseServer();
  const sp = await searchParams;

  const season = await resolveSeason(sb, sp?.season ?? null);
  if (!season) return <div className="text-white/70">Ingen säsong hittades.</div>;

  const seasonQuery = `?season=${encodeURIComponent(season.id)}`;

  // rules
  const rulesResp = await sb
    .from("season_rules")
    .select("vanlig_best_of,major_best_of,lagtavling_best_of")
    .eq("season_id", season.id)
    .single();

  const rules: RulesRow = (rulesResp.data as RulesRow | null) ?? {
    vanlig_best_of: 4,
    major_best_of: 3,
    lagtavling_best_of: 2,
  };

  const vanligBest = Number(rules.vanlig_best_of ?? 4);
  const majorBest = Number(rules.major_best_of ?? 3);
  const lagBest = Number(rules.lagtavling_best_of ?? 2);

  // season players
  const spResp = await sb
    .from("season_players")
    .select("id,person_id,hcp,people(name,avatar_url)")
    .eq("season_id", season.id);

  const sps = (spResp.data ?? []) as any[];

  const spIds = sps.map((x) => String(x.id));

  // results (locked only)
  let results: ResultRow[] = [];
  if (spIds.length) {
    const resResp = await sb
      .from("results")
      .select("season_player_id,poang,did_not_play,events(event_type,locked)")
      .in("season_player_id", spIds);

    results = (resResp.data ?? []) as any as ResultRow[];
  }

  const bySp = new Map<
    string,
    { vanlig: number[]; major: number[]; lag: number[] }
  >();

  for (const row of sps) bySp.set(String(row.id), { vanlig: [], major: [], lag: [] });

  for (const r of results) {
    if (r?.events?.locked !== true) continue;
    if (r.did_not_play) continue;

    const et = String(r?.events?.event_type ?? "");
    const pts = Number(r.poang ?? 0);
    const b = bySp.get(String(r.season_player_id));
    if (!b) continue;

    if (et === "VANLIG") b.vanlig.push(pts);
    else if (et === "MAJOR") b.major.push(pts);
    else if (et === "LAGTÄVLING") b.lag.push(pts);
  }

  const players: PlayerRow[] = sps
    .map((row: any) => {
      const id = String(row.id);
      const name = row.people?.name ?? "Okänd";
      const avatar_url = row.people?.avatar_url ?? null;
      const person_id = String(row.person_id);
      const hcp = Number(row.hcp ?? 0);

      const b = bySp.get(id)!;
      const total =
        sumTopN(b.vanlig, vanligBest) +
        sumTopN(b.major, majorBest) +
        sumTopN(b.lag, lagBest);

      return { person_id, name, avatar_url, hcp, total };
    })
    .sort((a, b) => b.total - a.total);

  return (
    <main className="space-y-6">
      {/* Header (utan "Till hem") */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="text-sm text-white/60">Spelare</div>
        <h1 className="mt-1 text-3xl sm:text-4xl font-semibold tracking-tight">{season.name}</h1>
      </section>

      {/* List */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <div className="divide-y divide-white/10">
          {players.map((p, idx) => (
            <Link
              key={p.person_id}
              href={`/players/${p.person_id}${seasonQuery}`}
              className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-white/5 transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-6 text-white/60 tabular-nums">{idx + 1}</div>

                <div className="h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-white/5 shrink-0">
                  {p.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatar_url} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs">⛳</div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="font-semibold truncate">{p.name}</div>
                  <div className="text-xs text-white/60">HCP {p.hcp.toFixed(1)}</div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-xs text-white/60">Total</div>
                <div className="text-lg font-semibold tabular-nums">{fmtInt(p.total)}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}