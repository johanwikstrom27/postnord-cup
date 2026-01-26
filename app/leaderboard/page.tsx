export const runtime = "nodejs";

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";

type SeasonRow = { id: string; name: string; created_at: string };
type RulesRow = { vanlig_best_of: number; major_best_of: number; lagtavling_best_of: number };

type SeasonPlayerRow = {
  id: string; // season_player_id
  person_id: string;
  people: { name: string; avatar_url: string | null } | null;
};

type EventRow = { id: string; event_type: string; locked: boolean };
type ResultRow = { season_player_id: string; event_id: string; poang: number; did_not_play: boolean };

async function resolveSeason(sb: ReturnType<typeof supabaseServer>, requestedSeasonId: string | null) {
  // 1) Om historik efterfrågas
  if (requestedSeasonId) {
    const r = await sb.from("seasons").select("id,name,created_at").eq("id", requestedSeasonId).single();
    const season = (r.data as SeasonRow | null) ?? null;
    if (season) return season;
  }

  // 2) Annars: aktuell säsong
  const cur = await sb
    .from("seasons")
    .select("id,name,created_at")
    .eq("is_current", true)
    .limit(1)
    .single();

  let season = (cur.data as SeasonRow | null) ?? null;

  // 3) Fallback: senaste
  if (!season) {
    const latest = await sb
      .from("seasons")
      .select("id,name,created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    season = (latest.data as SeasonRow | null) ?? null;
  }

  return season;
}

function sumTopN(values: number[], n: number) {
  return values
    .slice()
    .sort((a, b) => b - a)
    .slice(0, n)
    .reduce((acc, v) => acc + v, 0);
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  return (
    <div className="h-9 w-9 overflow-hidden rounded-full border border-white/10 bg-white/5">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs">⛳</div>
      )}
    </div>
  );
}

export default async function LeaderboardPage({
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

  // regler
  const rulesResp = await sb
    .from("season_rules")
    .select("vanlig_best_of,major_best_of,lagtavling_best_of")
    .eq("season_id", season.id)
    .single();

  const rules =
    (rulesResp.data as RulesRow | null) ?? ({ vanlig_best_of: 4, major_best_of: 3, lagtavling_best_of: 2 } as RulesRow);

  // spelare
  const spResp = await sb
    .from("season_players")
    .select("id, person_id, people(name, avatar_url)")
    .eq("season_id", season.id);

  const players = ((spResp.data ?? []) as any[]).map((p) => ({
    id: p.id,
    person_id: p.person_id,
    people: p.people ?? null,
  })) as SeasonPlayerRow[];

  const spIds = players.map((p) => p.id);

  // events
  const evResp = await sb
    .from("events")
    .select("id,event_type,locked")
    .eq("season_id", season.id);

  const events = (evResp.data as EventRow[] | null) ?? [];
  const lockedEventIds = events.filter((e) => e.locked).map((e) => e.id);

  const typeByEvent = new Map<string, string>();
  for (const e of events) typeByEvent.set(e.id, e.event_type);

  // results för låsta events
  let results: ResultRow[] = [];
  if (lockedEventIds.length && spIds.length) {
    const resResp = await sb
      .from("results")
      .select("season_player_id,event_id,poang,did_not_play")
      .in("event_id", lockedEventIds)
      .in("season_player_id", spIds);

    results = (resResp.data ?? []) as any[] as ResultRow[];
  }

  const bySp = new Map<
    string,
    { vanlig: number[]; major: number[]; lag: number[]; playedV: number; playedM: number; playedL: number }
  >();
  for (const p of players) bySp.set(p.id, { vanlig: [], major: [], lag: [], playedV: 0, playedM: 0, playedL: 0 });

  for (const r of results) {
    if (r.did_not_play) continue;
    const t = typeByEvent.get(r.event_id);
    const b = bySp.get(r.season_player_id);
    if (!t || !b) continue;

    const pts = Number(r.poang ?? 0);
    if (t === "VANLIG") { b.vanlig.push(pts); b.playedV++; }
    else if (t === "MAJOR") { b.major.push(pts); b.playedM++; }
    else if (t === "LAGTÄVLING") { b.lag.push(pts); b.playedL++; }
  }

  const rows = players
    .map((p) => {
      const name = p.people?.name ?? "Okänd";
      const avatar_url = p.people?.avatar_url ?? null;
      const b = bySp.get(p.id)!;

      const vanlig = sumTopN(b.vanlig, rules.vanlig_best_of);
      const major = sumTopN(b.major, rules.major_best_of);
      const lag = sumTopN(b.lag, rules.lagtavling_best_of);
      const total = vanlig + major + lag;

      return {
        person_id: p.person_id,
        name,
        avatar_url,
        vanlig,
        major,
        lag,
        total,
        deltagit: b.playedV + b.playedM + b.playedL,
        deltagitSplit: `${b.playedV}/${b.playedM}/${b.playedL}`,
      };
    })
    .sort((a, b) => b.total - a.total);

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-white/60">Leaderboard</div>
            <h1 className="text-3xl font-semibold tracking-tight">{season.name}</h1>
            <div className="mt-1 text-sm text-white/60">
              Räknar bästa {rules.vanlig_best_of} Vanlig / {rules.major_best_of} Major / {rules.lagtavling_best_of} Lagtävling
            </div>
          </div>
          <Link href="/" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10">
            Till hem →
          </Link>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-white/60">
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Spelare</th>
                <th className="px-4 py-3 text-right">Vanlig</th>
                <th className="px-4 py-3 text-right">Major</th>
                <th className="px-4 py-3 text-right">Lagtävling</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Deltagit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.map((r, idx) => (
                <tr key={r.person_id} className="hover:bg-white/5">
                  <td className="px-4 py-3 text-white/60">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <Link href={`/players/${r.person_id}${seasonQuery}`} className="flex items-center gap-3 hover:underline">
                      <Avatar url={r.avatar_url} name={r.name} />
                      <span className="font-medium">{r.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">{r.vanlig.toLocaleString("sv-SE")}</td>
                  <td className="px-4 py-3 text-right">{r.major.toLocaleString("sv-SE")}</td>
                  <td className="px-4 py-3 text-right">{r.lag.toLocaleString("sv-SE")}</td>
                  <td className="px-4 py-3 text-right font-semibold">{r.total.toLocaleString("sv-SE")}</td>
                  <td className="px-4 py-3 text-right text-white/70">
                    {r.deltagit} <span className="text-xs text-white/50">({r.deltagitSplit})</span>
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-white/60">
                    Inga spelare eller låsta tävlingar ännu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {requestedSeasonId ? (
        <div className="text-sm text-white/70">
          <Link href="/history" className="hover:underline">← Till historik</Link>
        </div>
      ) : null}
    </main>
  );
}