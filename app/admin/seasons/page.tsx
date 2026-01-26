export const runtime = "nodejs";

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";

type SeasonRow = { id: string; name: string; created_at: string; is_current: boolean };
type RulesRow = { vanlig_best_of: number; major_best_of: number; lagtavling_best_of: number };

type SPRow = {
  id: string;
  person_id: string;
  people: { name: string; avatar_url: string | null } | null;
};

type EventRow = { id: string; event_type: string; locked: boolean };
type ResRow = { season_player_id: string; event_id: string; poang: number; did_not_play: boolean };

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
        <div className="flex h-full w-full items-center justify-center text-lg">🏆</div>
      )}
    </div>
  );
}

function CurrentChip() {
  return (
    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
      Aktiv
    </span>
  );
}

async function computeWinner(sb: ReturnType<typeof supabaseServer>, seasonId: string) {
  const rulesResp = await sb
    .from("season_rules")
    .select("vanlig_best_of,major_best_of,lagtavling_best_of")
    .eq("season_id", seasonId)
    .single();

  const rules =
    (rulesResp.data as RulesRow | null) ?? ({
      vanlig_best_of: 4,
      major_best_of: 3,
      lagtavling_best_of: 2,
    } as RulesRow);

  const spResp = await sb
    .from("season_players")
    .select("id, person_id, people(name, avatar_url)")
    .eq("season_id", seasonId);

  const sps = (spResp.data ?? []) as any[] as SPRow[];
  if (!sps.length) return null;

  const spIds = sps.map((x) => x.id);

  const evResp = await sb
    .from("events")
    .select("id,event_type,locked")
    .eq("season_id", seasonId);

  const events = (evResp.data ?? []) as any[] as EventRow[];
  const lockedEventIds = events.filter((e) => e.locked).map((e) => e.id);
  if (!lockedEventIds.length) return { name: "—", avatar_url: null, total: 0 };

  const typeByEvent = new Map<string, string>();
  for (const e of events) typeByEvent.set(e.id, e.event_type);

  const resResp = await sb
    .from("results")
    .select("season_player_id,event_id,poang,did_not_play")
    .in("event_id", lockedEventIds)
    .in("season_player_id", spIds);

  const results = (resResp.data ?? []) as any[] as ResRow[];

  const bySp = new Map<string, { vanlig: number[]; major: number[]; lag: number[] }>();
  for (const id of spIds) bySp.set(id, { vanlig: [], major: [], lag: [] });

  for (const r of results) {
    if (r.did_not_play) continue;
    const t = typeByEvent.get(r.event_id);
    const b = bySp.get(r.season_player_id);
    if (!t || !b) continue;

    if (t === "VANLIG") b.vanlig.push(Number(r.poang ?? 0));
    else if (t === "MAJOR") b.major.push(Number(r.poang ?? 0));
    else if (t === "LAGTÄVLING") b.lag.push(Number(r.poang ?? 0));
  }

  const totals = sps.map((sp) => {
    const b = bySp.get(sp.id)!;
    const total =
      sumTopN(b.vanlig, rules.vanlig_best_of) +
      sumTopN(b.major, rules.major_best_of) +
      sumTopN(b.lag, rules.lagtavling_best_of);

    return {
      person_id: sp.person_id,
      name: sp.people?.name ?? "Okänd",
      avatar_url: sp.people?.avatar_url ?? null,
      total,
    };
  });

  totals.sort((a, b) => b.total - a.total);
  return totals[0];
}

export default async function AdminSeasonsPage() {
  const sb = supabaseServer();

  const seasonsResp = await sb
    .from("seasons")
    .select("id,name,created_at,is_current")
    .order("created_at", { ascending: false });

  const seasons = (seasonsResp.data as SeasonRow[] | null) ?? [];

  return (
    <main className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-sm text-white/60">Admin</div>
          <h1 className="text-2xl font-semibold">Säsonger</h1>
          <div className="text-sm text-white/60">Välj aktiv säsong och hantera historik.</div>
        </div>
        <Link href="/admin" className="text-sm text-white/70 hover:underline">
          ← Admin
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        {await Promise.all(
          seasons.map(async (s) => {
            const winner = await computeWinner(sb, s.id);

            return (
              <div key={s.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-white/60">Säsong</div>
                      {s.is_current ? <CurrentChip /> : null}
                    </div>
                    <div className="text-xl font-semibold">{s.name}</div>

                    <div className="mt-2 text-sm text-white/60">
                      Vinnare: <span className="font-medium text-white/80">{winner?.name ?? "—"}</span>
                    </div>
                    <div className="text-xs text-white/50">
                      {winner ? `${winner.total.toLocaleString("sv-SE")} p` : ""}
                    </div>
                  </div>

                  <Avatar url={winner?.avatar_url ?? null} name={winner?.name ?? "—"} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <form method="POST" action="/api/admin/seasons/set-current">
                    <input type="hidden" name="season_id" value={s.id} />
                    <button className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
                      Sätt som aktiv
                    </button>
                  </form>

                  <Link
                    href={`/admin?season=${encodeURIComponent(s.id)}`}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                  >
                    Öppna i admin →
                  </Link>

                  <Link
                    href={`/?season=${encodeURIComponent(s.id)}`}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                  >
                    Visa publikt →
                  </Link>
                </div>

                <div className="mt-2 text-xs text-white/50">ID: {s.id}</div>
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}