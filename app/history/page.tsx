export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";

type SeasonRow = { id: string; name: string; created_at: string };

type RulesRow = {
  season_id: string;
  vanlig_best_of: number | null;
  major_best_of: number | null;
  lagtavling_best_of: number | null;
};

type PersonRow = { name: string; avatar_url: string | null };

type FinalWinnerRow = {
  season_player_id: string;
  placering: number | null;
  season_players: { person_id: string; people: PersonRow | null } | null;
};

type EventRow = { id: string; event_type: string; locked: boolean };

type SPRow = {
  id: string; // season_player_id
  person_id: string;
  people: PersonRow | null;
};

type ResRow = { season_player_id: string; event_id: string; poang: number | null; did_not_play: boolean; events: { event_type: string; locked: boolean } | null };

function sumTopN(values: number[], n: number) {
  return values
    .slice()
    .sort((a, b) => b - a)
    .slice(0, n)
    .reduce((acc, v) => acc + v, 0);
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  return (
    <div className="h-12 w-12 overflow-hidden rounded-full border border-white/10 bg-white/5">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-lg">⛳</div>
      )}
    </div>
  );
}

async function getFinalEvent(sb: ReturnType<typeof supabaseServer>, seasonId: string) {
  const ev = await sb
    .from("events")
    .select("id,event_type,locked")
    .eq("season_id", seasonId)
    .eq("event_type", "FINAL")
    .limit(1)
    .single();

  return (ev.data as EventRow | null) ?? null;
}

async function getFinalWinner(sb: ReturnType<typeof supabaseServer>, finalEventId: string) {
  const r = await sb
    .from("results")
    .select("season_player_id,placering,season_players(person_id,people(name,avatar_url))")
    .eq("event_id", finalEventId)
    .eq("placering", 1)
    .limit(1)
    .single();

  const row = (r.data as FinalWinnerRow | null) ?? null;
  if (!row?.season_players?.people) return null;

  return {
    person_id: row.season_players.person_id,
    name: row.season_players.people.name,
    avatar_url: row.season_players.people.avatar_url ?? null,
  };
}

async function getSeriesLeader(sb: ReturnType<typeof supabaseServer>, seasonId: string) {
  // regler
  const rulesResp = await sb
    .from("season_rules")
    .select("season_id,vanlig_best_of,major_best_of,lagtavling_best_of")
    .eq("season_id", seasonId)
    .single();

  const rules = (rulesResp.data as RulesRow | null) ?? ({
    season_id: seasonId,
    vanlig_best_of: 4,
    major_best_of: 3,
    lagtavling_best_of: 2,
  } as RulesRow);

  const vanligBest = Number(rules.vanlig_best_of ?? 4);
  const majorBest = Number(rules.major_best_of ?? 3);
  const lagBest = Number(rules.lagtavling_best_of ?? 2);

  // spelare i säsongen
  const spResp = await sb
    .from("season_players")
    .select("id,person_id,people(name,avatar_url)")
    .eq("season_id", seasonId);

  const sps = (spResp.data ?? []) as any[] as SPRow[];
  if (!sps.length) return null;

  const spIds = sps.map((x) => x.id);

  // results med event info (för att filtrera låsta och exkludera FINAL)
  const resResp = await sb
    .from("results")
    .select("season_player_id,poang,did_not_play,events(event_type,locked)")
    .in("season_player_id", spIds);

  const rows = (resResp.data ?? []) as any[] as ResRow[];

  const bySp = new Map<string, { vanlig: number[]; major: number[]; lag: number[] }>();
  for (const p of sps) bySp.set(p.id, { vanlig: [], major: [], lag: [] });

  for (const r of rows) {
    if (r?.events?.locked !== true) continue;
    if (r.did_not_play) continue;

    const et = String(r.events?.event_type ?? "");
    if (et === "FINAL") continue; // ✅ serieledare = exkl finalen

    const b = bySp.get(String(r.season_player_id));
    if (!b) continue;

    const pts = Number(r.poang ?? 0);
    if (et === "VANLIG") b.vanlig.push(pts);
    else if (et === "MAJOR") b.major.push(pts);
    else if (et === "LAGTÄVLING") b.lag.push(pts);
  }

  const totals = sps.map((p) => {
    const b = bySp.get(p.id)!;
    const total = sumTopN(b.vanlig, vanligBest) + sumTopN(b.major, majorBest) + sumTopN(b.lag, lagBest);

    return {
      person_id: p.person_id,
      name: p.people?.name ?? "Okänd",
      avatar_url: p.people?.avatar_url ?? null,
      total,
    };
  });

  totals.sort((a, b) => b.total - a.total);
  return totals[0] ?? null;
}

export default async function HistoryPage() {
  const sb = supabaseServer();

  const seasonsResp = await sb
    .from("seasons")
    .select("id,name,created_at")
    .order("created_at", { ascending: false });

  const seasons = (seasonsResp.data as SeasonRow[] | null) ?? [];

  // Endast säsonger där FINAL finns och är låst
  const finished: Array<{ season: SeasonRow; finalEventId: string }> = [];
  for (const s of seasons) {
    const fe = await getFinalEvent(sb, s.id);
    if (fe?.locked === true) finished.push({ season: s, finalEventId: fe.id });
  }

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-3xl font-semibold tracking-tight">Historik</h1>
        <p className="mt-1 text-sm text-white/60">Här visas avslutade säsonger (finalen är låst).</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {await Promise.all(
          finished.map(async ({ season, finalEventId }) => {
            const seasonQuery = `?season=${encodeURIComponent(season.id)}`;

            const finalWinner = await getFinalWinner(sb, finalEventId);
            const seriesLeader = await getSeriesLeader(sb, season.id);

            return (
              <div key={season.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-xs text-white/60">Säsong</div>
                <div className="text-xl font-semibold">{season.name}</div>

                <div className="mt-5 grid gap-4">
                  {/* Final winner */}
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="min-w-0">
                      <div className="text-xs text-white/60">Vinnare PostNord Cup Final</div>
                      <div className="font-semibold truncate">{finalWinner?.name ?? "—"}</div>
                    </div>
                    <Avatar url={finalWinner?.avatar_url ?? null} name={finalWinner?.name ?? "—"} />
                  </div>

                  {/* Series leader */}
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="min-w-0">
                      <div className="text-xs text-white/60">Ledare av serien</div>
                      <div className="font-semibold truncate">{seriesLeader?.name ?? "—"}</div>
                      <div className="text-xs text-white/60">
                        {seriesLeader ? `${seriesLeader.total.toLocaleString("sv-SE")} p` : ""}
                      </div>
                    </div>
                    <Avatar url={seriesLeader?.avatar_url ?? null} name={seriesLeader?.name ?? "—"} />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    href={`/leaderboard${seasonQuery}`}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                  >
                    Leaderboard →
                  </Link>
                  <Link
                    href={`/events${seasonQuery}`}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                  >
                    Tävlingar →
                  </Link>
                  <Link
                    href={`/players${seasonQuery}`}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                  >
                    Spelare →
                  </Link>
                </div>
              </div>
            );
          })
        )}

        {finished.length === 0 && <div className="text-white/60">Inga avslutade säsonger ännu.</div>}
      </section>

      <div className="text-sm text-white/70">
        <Link href="/" className="hover:underline">
          ← Till startsidan
        </Link>
      </div>
    </main>
  );
}