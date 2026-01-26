export const runtime = "nodejs";

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";

type SeasonRow = { id: string; name: string; created_at: string };

type RulesRow = {
  vanlig_best_of: number;
  major_best_of: number;
  lagtavling_best_of: number;
};

type PersonRow = {
  id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  fun_facts: string | null;
  strengths: string | null;
  weaknesses: string | null;
};

type SeasonPlayerRow = { id: string; hcp: number };

type ResultHistRow = {
  season_player_id: string;
  event_id: string;
  poang: number;
  placering: number | null;
  gross_strokes: number | null;
  net_strokes: number | null;
  adjusted_score: number | null;
  lag_nr: number | null;
  lag_score: number | null;
  did_not_play: boolean;
  events: { name: string; event_type: string; starts_at: string; locked: boolean } | null;
};

async function resolveSeason(sb: ReturnType<typeof supabaseServer>, requestedSeasonId: string | null) {
  if (requestedSeasonId) {
    const r = await sb.from("seasons").select("id,name,created_at").eq("id", requestedSeasonId).single();
    const s = (r.data as SeasonRow | null) ?? null;
    if (s) return s;
  }

  const cur = await sb
    .from("seasons")
    .select("id,name,created_at")
    .eq("is_current", true)
    .limit(1)
    .single();

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

function typeLabel(t: string) {
  if (t === "VANLIG") return "Vanlig";
  if (t === "MAJOR") return "Major";
  if (t === "LAGTÄVLING") return "Lagtävling";
  if (t === "FINAL") return "Final";
  return t;
}

function fmtShortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("sv-SE", { month: "short", day: "numeric" });
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
    <div className="h-16 w-16 overflow-hidden rounded-full border border-white/10 bg-white/5">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-2xl">⛳</div>
      )}
    </div>
  );
}

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { id: personId } = await params;
  const spSearch = await searchParams;

  const sb = supabaseServer();
  const requestedSeasonId = spSearch?.season ?? null;

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
    (rulesResp.data as RulesRow | null) ??
    ({ vanlig_best_of: 4, major_best_of: 3, lagtavling_best_of: 2 } as RulesRow);

  // personprofil (people) – här ligger bio/kuriosa/styrkor/svagheter
  const personResp = await sb
    .from("people")
    .select("id,name,avatar_url,bio,fun_facts,strengths,weaknesses")
    .eq("id", personId)
    .single();

  const person = (personResp.data as PersonRow | null) ?? null;
  if (!person) return <div className="text-white/70">Spelaren hittades inte.</div>;

  // säsongs-HCP
  const spResp = await sb
    .from("season_players")
    .select("id,hcp")
    .eq("season_id", season.id)
    .eq("person_id", personId)
    .single();

  const spRow = (spResp.data as SeasonPlayerRow | null) ?? null;
  const seasonPlayerId = spRow?.id ?? null;

  // historik (för vald säsong)
  let historyAll: ResultHistRow[] = [];
  if (seasonPlayerId) {
    const histResp = await sb
      .from("results")
      .select(
        "season_player_id,event_id,poang,placering,gross_strokes,net_strokes,adjusted_score,lag_nr,lag_score,did_not_play,events(name,event_type,starts_at,locked)"
      )
      .eq("season_player_id", seasonPlayerId)
      .order("created_at", { ascending: false });

    historyAll = (histResp.data ?? []) as unknown as ResultHistRow[];
  }

  const history = historyAll.filter((r) => r.events?.locked === true && !!r.events?.starts_at);

  // statistik
  const ptsVanlig: number[] = [];
  const ptsMajor: number[] = [];
  const ptsLag: number[] = [];
  const played = { vanlig: 0, major: 0, lag: 0, final: 0 };

  for (const r of history) {
    if (r.did_not_play) continue;
    const et = r.events!.event_type;

    if (et === "VANLIG") {
      played.vanlig++;
      ptsVanlig.push(Number(r.poang ?? 0));
    } else if (et === "MAJOR") {
      played.major++;
      ptsMajor.push(Number(r.poang ?? 0));
    } else if (et === "LAGTÄVLING") {
      played.lag++;
      ptsLag.push(Number(r.poang ?? 0));
    } else if (et === "FINAL") {
      played.final++;
    }
  }

  const vanligCounted = sumTopN(ptsVanlig, rules.vanlig_best_of);
  const majorCounted = sumTopN(ptsMajor, rules.major_best_of);
  const lagCounted = sumTopN(ptsLag, rules.lagtavling_best_of);
  const totalCounted = vanligCounted + majorCounted + lagCounted;

  const placings = history
    .filter((r) => r.events!.event_type !== "FINAL")
    .map((r) => r.placering)
    .filter((x): x is number => typeof x === "number");

  const bestPlace = placings.length ? Math.min(...placings) : null;
  const avgPlace = placings.length ? placings.reduce((a, v) => a + v, 0) / placings.length : null;

  const latest3 = history
    .slice()
    .sort((a, b) => new Date(b.events!.starts_at).getTime() - new Date(a.events!.starts_at).getTime())
    .slice(0, 3);

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href={`/players${seasonQuery}`} className="text-sm text-white/70 hover:underline">
          ← Till spelare
        </Link>
        <Link href={`/leaderboard${seasonQuery}`} className="text-sm text-white/70 hover:underline">
          Leaderboard →
        </Link>
      </div>

      {/* Header */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="flex items-center gap-4">
          <Avatar url={person.avatar_url} name={person.name} />
          <div className="flex-1">
            <h1 className="text-2xl font-semibold">{person.name}</h1>
            <div className="text-sm text-white/60">
              {season.name} • HCP {spRow ? spRow.hcp.toFixed(1) : "—"}
            </div>
          </div>

          <div className="text-right">
            {/* ✅ ändrat */}
            <div className="text-xs text-white/60">Totalpoäng</div>
            <div className="text-2xl font-bold">{totalCounted.toLocaleString("sv-SE")}</div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          {/* ✅ ändrat */}
          <div className="text-xs text-white/60">Poängfördelning</div>
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Vanlig</span>
              <b>{vanligCounted.toLocaleString("sv-SE")}</b>
            </div>
            <div className="flex justify-between">
              <span>Major</span>
              <b>{majorCounted.toLocaleString("sv-SE")}</b>
            </div>
            <div className="flex justify-between">
              <span>Lagtävling</span>
              <b>{lagCounted.toLocaleString("sv-SE")}</b>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60">Deltagit</div>
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Vanlig</span>
              <b>{played.vanlig}</b>
            </div>
            <div className="flex justify-between">
              <span>Major</span>
              <b>{played.major}</b>
            </div>
            <div className="flex justify-between">
              <span>Lagtävling</span>
              <b>{played.lag}</b>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60">Placering</div>
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Bästa</span>
              <b>{bestPlace ?? "—"}</b>
            </div>
            <div className="flex justify-between">
              <span>Snitt</span>
              <b>{avgPlace ? avgPlace.toFixed(1) : "—"}</b>
            </div>
          </div>
        </div>
      </section>

      {/* Latest 3 */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Senaste 3 tävlingar</h2>
          {/* ✅ borttagen "Låsta" */}
          <span className="text-xs text-white/60"></span>
        </div>

        <div className="mt-3 space-y-2">
          {latest3.length ? (
            latest3.map((r) => {
              const et = r.events!.event_type;
              const resultText =
                et === "FINAL"
                  ? `Adj ${r.adjusted_score ?? "—"}`
                  : et === "LAGTÄVLING"
                  ? `Lag ${r.lag_score ?? "—"}`
                  : `Net ${r.net_strokes ?? "—"}`;

              return (
                <Link
                  key={`${r.event_id}-${r.season_player_id}`}
                  href={`/events/${r.event_id}${seasonQuery}`}
                  className="block rounded-xl border border-white/10 bg-black/20 p-3 hover:bg-black/30"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{r.events!.name}</div>
                      <div className="text-xs text-white/60">
                        {typeLabel(et)} • {fmtShortDate(r.events!.starts_at)}
                      </div>
                    </div>

                    <div className="text-right text-sm">
                      <div className="font-semibold">{resultText}</div>
                      {/* ✅ ändrat Pl -> Placering */}
                      <div className="text-xs text-white/60">
                        Placering {r.placering ?? "—"} • {Number(r.poang ?? 0).toLocaleString("sv-SE")} p
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="text-sm text-white/60">Inga låsta resultat ännu.</div>
          )}
        </div>
      </section>

      {/* ✅ Profilinfo från admin (people) */}
      {(person.bio || person.fun_facts || person.strengths || person.weaknesses) && (
        <section className="grid gap-4 md:grid-cols-2">
          {(person.bio || person.fun_facts) && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="font-semibold">Om {person.name}</h2>
              {person.bio && <p className="mt-2 text-white/70 whitespace-pre-line">{person.bio}</p>}
              {person.fun_facts && (
                <p className="mt-3 text-white/70 whitespace-pre-line">
                  <span className="font-semibold">Kuriosa:</span> {person.fun_facts}
                </p>
              )}
            </div>
          )}

          {(person.strengths || person.weaknesses) && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="font-semibold">Styrkor & svagheter</h2>
              {person.strengths && (
                <p className="mt-2 text-white/70 whitespace-pre-line">
                  ✅ {person.strengths}
                </p>
              )}
              {person.weaknesses && (
                <p className="mt-3 text-white/70 whitespace-pre-line">
                  ⚠️ {person.weaknesses}
                </p>
              )}
            </div>
          )}
        </section>
      )}

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