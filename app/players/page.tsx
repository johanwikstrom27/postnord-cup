export const runtime = "nodejs";

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";

type SeasonRow = { id: string; name: string; created_at: string };
type RulesRow = { vanlig_best_of: number; major_best_of: number; lagtavling_best_of: number };

type SeasonPlayerRow = {
  id: string; // season_player_id
  person_id: string;
  hcp: number;
  people: { name: string; avatar_url: string | null } | null;
};

type EventRow = { id: string; event_type: string; locked: boolean };
type ResRow = { season_player_id: string; event_id: string; poang: number; did_not_play: boolean };

async function resolveSeason(sb: ReturnType<typeof supabaseServer>, requestedSeasonId: string | null) {
  if (requestedSeasonId) {
    const r = await sb.from("seasons").select("id,name,created_at").eq("id", requestedSeasonId).single();
    const s = (r.data as SeasonRow | null) ?? null;
    if (s) return s;
  }

  const cur = await sb.from("seasons").select("id,name,created_at").eq("is_current", true).limit(1).single();
  let season = (cur.data as SeasonRow | null) ?? null;

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
  return values.slice().sort((a, b) => b - a).slice(0, n).reduce((acc, v) => acc + v, 0);
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  return (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm">⛳</div>
      )}
    </div>
  );
}

export default async function PlayersPage({
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

  const rulesResp = await sb
    .from("season_rules")
    .select("vanlig_best_of,major_best_of,lagtavling_best_of")
    .eq("season_id", season.id)
    .single();

  const rules =
    (rulesResp.data as RulesRow | null) ?? ({ vanlig_best_of: 4, major_best_of: 3, lagtavling_best_of: 2 } as RulesRow);

  const spResp = await sb
    .from("season_players")
    .select("id, person_id, hcp, people(name, avatar_url)")
    .eq("season_id", season.id);

  const players = ((spResp.data ?? []) as any[]).map((p) => ({
    id: p.id,
    person_id: p.person_id,
    hcp: Number(p.hcp),
    people: p.people ?? null,
  })) as SeasonPlayerRow[];

  const spIds = players.map((p) => p.id);

  const evResp = await sb
    .from("events")
    .select("id,event_type,locked")
    .eq("season_id", season.id);

  const events = (evResp.data as EventRow[] | null) ?? [];
  const lockedEventIds = events.filter((e) => e.locked).map((e) => e.id);

  const typeByEvent = new Map<string, string>();
  for (const e of events) typeByEvent.set(e.id, e.event_type);

  let results: ResRow[] = [];
  if (lockedEventIds.length && spIds.length) {
    const resResp = await sb
      .from("results")
      .select("season_player_id,event_id,poang,did_not_play")
      .in("event_id", lockedEventIds)
      .in("season_player_id", spIds);

    results = (resResp.data ?? []) as any[] as ResRow[];
  }

  const bySp = new Map<string, { vanlig: number[]; major: number[]; lag: number[] }>();
  for (const p of players) bySp.set(p.id, { vanlig: [], major: [], lag: [] });

  for (const r of results) {
    if (r.did_not_play) continue;
    const t = typeByEvent.get(r.event_id);
    const b = bySp.get(r.season_player_id);
    if (!t || !b) continue;

    if (t === "VANLIG") b.vanlig.push(Number(r.poang ?? 0));
    else if (t === "MAJOR") b.major.push(Number(r.poang ?? 0));
    else if (t === "LAGTÄVLING") b.lag.push(Number(r.poang ?? 0));
  }

  const rows = players
    .map((p) => {
      const name = p.people?.name ?? "Okänd";
      const avatar_url = p.people?.avatar_url ?? null;
      const b = bySp.get(p.id)!;
      const total =
        sumTopN(b.vanlig, rules.vanlig_best_of) +
        sumTopN(b.major, rules.major_best_of) +
        sumTopN(b.lag, rules.lagtavling_best_of);
      return { person_id: p.person_id, name, avatar_url, total, hcp: p.hcp };
    })
    .sort((a, b) => b.total - a.total);

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-white/60">Spelare</div>
            <h1 className="text-3xl font-semibold tracking-tight">{season.name}</h1>
          </div>
          <Link href="/" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10">
            Till hem →
          </Link>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        {rows.map((r, idx) => (
          <Link
            key={r.person_id}
            href={`/players/${r.person_id}${seasonQuery}`}
            className="flex items-center justify-between border-b border-white/10 px-4 py-4 hover:bg-white/5 last:border-b-0"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 text-white/60">{idx + 1}</div>
              <Avatar url={r.avatar_url} name={r.name} />
              <div>
                <div className="font-semibold">{r.name}</div>
                <div className="text-xs text-white/60">HCP {r.hcp.toFixed(1)}</div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-white/60">Total</div>
              <div className="font-semibold">{r.total.toLocaleString("sv-SE")}</div>
            </div>
          </Link>
        ))}
      </section>

      {requestedSeasonId ? (
        <div className="text-sm text-white/70">
          <Link href="/history" className="hover:underline">
            ← Till historik
          </Link>
        </div>
      ) : null}
    </main>
  );
}