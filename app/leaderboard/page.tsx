export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";

type SeasonRow = { id: string; name: string; created_at: string; is_current?: boolean };
type RulesRow = { vanlig_best_of: number | null; major_best_of: number | null; lagtavling_best_of: number | null };

type SPRow = {
  id: string; // season_player_id
  person_id: string;
  hcp: number;
  people: { name: string; avatar_url: string | null } | null;
};

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

async function resolveSeason(
  sb: ReturnType<typeof supabaseServer>,
  requestedSeasonId: string | null
): Promise<SeasonRow | null> {
  if (requestedSeasonId) {
    const r = await sb.from("seasons").select("id,name,created_at,is_current").eq("id", requestedSeasonId).single();
    if (r.data) return r.data as SeasonRow;
  }

  const cur = await sb.from("seasons").select("id,name,created_at,is_current").eq("is_current", true).limit(1).single();
  if (cur.data) return cur.data as SeasonRow;

  const latest = await sb
    .from("seasons")
    .select("id,name,created_at,is_current")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return (latest.data as SeasonRow) ?? null;
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const sb = supabaseServer();
  const sp = await searchParams;

  const season = await resolveSeason(sb, sp?.season ?? null);
  if (!season) return <div className="text-white/70">Ingen säsong hittades.</div>;

  const seasonQuery = `?season=${encodeURIComponent(season.id)}`;

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

  // season_players + people
  const spResp = await sb
    .from("season_players")
    .select("id,person_id,hcp,people(name,avatar_url)")
    .eq("season_id", season.id);

  const players = ((spResp.data ?? []) as any[]).map((p) => ({
    id: String(p.id),
    person_id: String(p.person_id),
    hcp: Number(p.hcp ?? 0),
    people: p.people ?? null,
  })) as SPRow[];

  const spIds = players.map((p) => p.id);

  // results + events info (locked + typ)
  let results: ResultRow[] = [];
  if (spIds.length) {
    const resResp = await sb
      .from("results")
      .select("season_player_id,poang,did_not_play,events(event_type,locked)")
      .in("season_player_id", spIds);

    results = (resResp.data ?? []) as any as ResultRow[];
  }

  // bucket per player
  const bySp = new Map<
    string,
    { vanlig: number[]; major: number[]; lag: number[]; participated: { vanlig: number; major: number; lag: number } }
  >();

  for (const p of players) {
    bySp.set(p.id, { vanlig: [], major: [], lag: [], participated: { vanlig: 0, major: 0, lag: 0 } });
  }

  for (const r of results) {
    if (r?.events?.locked !== true) continue;
    if (r.did_not_play) continue;

    const et = String(r?.events?.event_type ?? "");
    const pts = Number(r.poang ?? 0);
    const b = bySp.get(String(r.season_player_id));
    if (!b) continue;

    if (et === "VANLIG") {
      b.vanlig.push(pts);
      b.participated.vanlig += 1;
    } else if (et === "MAJOR") {
      b.major.push(pts);
      b.participated.major += 1;
    } else if (et === "LAGTÄVLING") {
      b.lag.push(pts);
      b.participated.lag += 1;
    } else {
      // FINAL räknas inte i serie-totalen
    }
  }

  const rows = players
    .map((p) => {
      const name = p.people?.name ?? "Okänd";
      const avatar = p.people?.avatar_url ?? null;

      const b = bySp.get(p.id)!;

      const vanlig = sumTopN(b.vanlig, vanligBest);
      const major = sumTopN(b.major, majorBest);
      const lag = sumTopN(b.lag, lagBest);
      const total = vanlig + major + lag;

      const deltagitTotal = b.participated.vanlig + b.participated.major + b.participated.lag;

      return {
        person_id: p.person_id,
        name,
        avatar,
        total,
        vanlig,
        major,
        lag,
        deltagitTotal,
        participated: b.participated,
      };
    })
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.name.localeCompare(b.name);
    });

  return (
    <main className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="text-sm text-white/60">Leaderboard</div>
        <h1 className="mt-1 text-3xl sm:text-4xl font-semibold tracking-tight">{season.name}</h1>
        <div className="mt-2 text-white/60">
          Räknar bästa {vanligBest} Vanlig / {majorBest} Major / {lagBest} Lagtävling
        </div>
      </section>

      {/* Table */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-white/60">
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-left w-10">#</th>
                <th className="px-4 py-3 text-left">Spelare</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Vanlig</th>
                <th className="px-4 py-3 text-right">Major</th>
                <th className="px-4 py-3 text-right">Lagtävling</th>
                <th className="px-4 py-3 text-right">Deltagit</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {rows.map((r, idx) => (
                <tr key={r.person_id} className="hover:bg-white/5">
                  <td className="px-4 py-3 text-white/60">{idx + 1}</td>

                  <td className="px-4 py-3">
                    <Link
                      href={`/players/${r.person_id}${seasonQuery}`}
                      className="flex items-center gap-3 hover:underline"
                    >
                      <div className="h-9 w-9 overflow-hidden rounded-full border border-white/10 bg-white/5 shrink-0">
                        {r.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.avatar} alt={r.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs">⛳</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{r.name}</div>
                      </div>
                    </Link>
                  </td>

                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmtInt(r.total)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtInt(r.vanlig)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtInt(r.major)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtInt(r.lag)}</td>

                  {/* ✅ Force one-line layout */}
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                    <span className="inline-flex items-baseline gap-2">
                      <span className="text-white/90">{r.deltagitTotal}</span>
                      <span className="text-white/50">
                        ({r.participated.vanlig}/{r.participated.major}/{r.participated.lag})
                      </span>
                    </span>
                  </td>
                </tr>
              ))}

              {!rows.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-white/60">
                    Inga resultat ännu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}