export const runtime = "nodejs";

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";
import CoverImage from "@/components/CoverImage";

/* ===========================
   Types
=========================== */
type EventRow = {
  id: string;
  season_id: string;
  name: string;
  event_type: "VANLIG" | "MAJOR" | "LAGTÄVLING" | "FINAL" | string;
  starts_at: string;
  course: string | null;
  description: string | null;
  image_url: string | null;
  setting_wind: string | null;
  setting_tee_meters: number | null;
  setting_pins: string | null;
  locked: boolean;
};

type RulesRow = {
  vanlig_best_of: number | null;
  major_best_of: number | null;
  lagtavling_best_of: number | null;
  hcp_zero_max: number | null;
  hcp_two_max: number | null;
  hcp_four_min: number | null;
};

type ResultRow = {
  event_id: string;
  season_player_id: string;
  gross_strokes: number | null;
  hcp_strokes: number | null;
  net_strokes: number | null;
  adjusted_score: number | null;
  placering: number | null;
  poang: number | null;
  did_not_play: boolean;
  lag_nr: number | null;
  lag_score: number | null;
  season_players: {
    person_id: string;
    hcp: number | null; // ✅ NYTT (för Start inkl. PN-HCP i final)
    people: { name: string; avatar_url: string | null } | null;
  } | null;
};

type StartScoreRow = { season_player_id: string; start_score: number };
type PrelimRow = {
  rank: number;
  baseRank: number;
  person_id: string;
  name: string;
  total: number;
  hcp: number;
  hcp_strokes: number;
  start_base: number;
  start_incl_hcp: number;
};

/* ===========================
   Helpers
=========================== */
function typeLabel(t: string) {
  if (t === "VANLIG") return "Vanlig";
  if (t === "MAJOR") return "Major";
  if (t === "LAGTÄVLING") return "Lagtävling";
  if (t === "FINAL") return "Final";
  return t;
}

function fmtDateTimeLong(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function startScoreForRank(rank: number) {
  if (rank === 1) return -10;
  if (rank === 2) return -8;
  if (rank === 3) return -6;
  if (rank === 4) return -5;
  if (rank === 5) return -4;
  if (rank === 6) return -3;
  if (rank === 7) return -2;
  if (rank === 8) return -1;
  return 0;
}

function hcpToStrokes(hcp: number, rules: RulesRow) {
  const zeroMax = Number(rules.hcp_zero_max ?? 10.5);
  const twoMax = Number(rules.hcp_two_max ?? 15.5);
  const fourMin = Number(rules.hcp_four_min ?? 15.6);

  if (hcp <= zeroMax) return 0;
  if (hcp < fourMin && hcp <= twoMax) return 2;
  return 4;
}

function sumTopN(values: number[], n: number) {
  return values
    .slice()
    .sort((a, b) => b - a)
    .slice(0, n)
    .reduce((acc, v) => acc + v, 0);
}

async function computePrelimFinalStartlist(
  sb: ReturnType<typeof supabaseServer>,
  seasonId: string,
  rules: RulesRow
): Promise<PrelimRow[]> {
  const vanligBest = Number(rules.vanlig_best_of ?? 4);
  const majorBest = Number(rules.major_best_of ?? 3);
  const lagBest = Number(rules.lagtavling_best_of ?? 2);

  const spResp = await sb
    .from("season_players")
    .select("id, person_id, hcp, people(name)")
    .eq("season_id", seasonId);

  const sps = (spResp.data ?? []) as any[];
  if (!sps.length) return [];

  const spIds = sps.map((x) => x.id);

  const resResp = await sb
    .from("results")
    .select("season_player_id, poang, did_not_play, events(event_type, locked)")
    .in("season_player_id", spIds);

  const all = (resResp.data ?? []) as any[];

  const bySp = new Map<string, { vanlig: number[]; major: number[]; lag: number[] }>();
  for (const p of sps) bySp.set(p.id, { vanlig: [], major: [], lag: [] });

  for (const r of all) {
    if (r?.events?.locked !== true) continue;
    if (r.did_not_play) continue;

    const et = String(r?.events?.event_type ?? "");
    if (et === "FINAL") continue;

    const pts = Number(r.poang ?? 0);
    const b = bySp.get(r.season_player_id);
    if (!b) continue;

    if (et === "VANLIG") b.vanlig.push(pts);
    else if (et === "MAJOR") b.major.push(pts);
    else if (et === "LAGTÄVLING") b.lag.push(pts);
  }

  const totals = sps.map((p) => {
    const b = bySp.get(p.id)!;
    const total =
      sumTopN(b.vanlig, vanligBest) +
      sumTopN(b.major, majorBest) +
      sumTopN(b.lag, lagBest);

    return {
      season_player_id: p.id,
      person_id: p.person_id,
      name: p.people?.name ?? "Okänd",
      hcp: Number(p.hcp ?? 0),
      total,
    };
  });

  totals.sort((a, b) => b.total - a.total);
  const top12 = totals.slice(0, 12);

  const rows = top12.map((p, idx) => {
    const baseRank = idx + 1;
    const start_base = startScoreForRank(baseRank);
    const hcp_strokes = hcpToStrokes(p.hcp, rules);
    const start_incl_hcp = start_base - hcp_strokes;

    return {
      baseRank,
      person_id: p.person_id,
      name: p.name,
      total: p.total,
      hcp: p.hcp,
      hcp_strokes,
      start_base,
      start_incl_hcp,
    };
  });

  rows.sort((a, b) => a.start_incl_hcp - b.start_incl_hcp);

  return rows.map((r, idx) => ({
    rank: idx + 1,
    ...r,
  })) as PrelimRow[];
}

// ✅ Competition ranking: 1,2,2,4… baserat på score (lägre = bättre)
function computeSharedPlacings(sorted: ResultRow[]): Map<string, number> {
  const placeBySp = new Map<string, number>();

  let place = 1;
  let prevScore: number | null = null;

  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const s = r.adjusted_score;
    if (s == null) continue;

    if (i === 0) {
      place = 1;
    } else {
      if (prevScore !== s) {
        place = i + 1;
      }
    }

    placeBySp.set(r.season_player_id, place);
    prevScore = s;
  }

  return placeBySp;
}

/* ===========================
   Page
=========================== */
export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const seasonQuery = sp?.season ? `?season=${encodeURIComponent(sp.season)}` : "";

  const sb = supabaseServer();

  const eventResp = await sb
    .from("events")
    .select(
      "id,season_id,name,event_type,starts_at,course,description,image_url,setting_wind,setting_tee_meters,setting_pins,locked"
    )
    .eq("id", id)
    .single();

  const event = (eventResp.data as EventRow | null) ?? null;
  if (!event) {
    return (
      <main className="space-y-4">
        <Link href={`/events${seasonQuery}`} className="text-sm text-white/70 hover:underline">
          ← Till tävlingar
        </Link>
        <div className="text-white/70">Tävlingen hittades inte.</div>
      </main>
    );
  }

  const isFinal = event.event_type === "FINAL";
  const isTeam = event.event_type === "LAGTÄVLING";

  const rulesResp = await sb
    .from("season_rules")
    .select("vanlig_best_of,major_best_of,lagtavling_best_of,hcp_zero_max,hcp_two_max,hcp_four_min")
    .eq("season_id", event.season_id)
    .single();

  const rules = (rulesResp.data as RulesRow | null) ?? {
    vanlig_best_of: 4,
    major_best_of: 3,
    lagtavling_best_of: 2,
    hcp_zero_max: 10.5,
    hcp_two_max: 15.5,
    hcp_four_min: 15.6,
  };

  // Results (locked)
  let results: ResultRow[] = [];
  if (event.locked) {
    const resResp = await sb
      .from("results")
      .select(
        // ✅ Enda ändringen här: season_players(hcp, ...)
        "event_id,season_player_id,gross_strokes,hcp_strokes,net_strokes,adjusted_score,placering,poang,did_not_play,lag_nr,lag_score,season_players(person_id,hcp,people(name,avatar_url))"
      )
      .eq("event_id", event.id);

    results = (resResp.data ?? []) as unknown as ResultRow[];
  }

  // Start scores map for final
  const startScoreMap = new Map<string, number>();
  if (isFinal) {
    const ssResp = await sb
      .from("event_start_scores")
      .select("season_player_id,start_score")
      .eq("event_id", event.id);

    for (const r of (ssResp.data ?? []) as unknown as StartScoreRow[]) {
      startScoreMap.set(String(r.season_player_id), Number(r.start_score ?? 0));
    }
  }

  // Prelim final
  const prelim = isFinal && !event.locked ? await computePrelimFinalStartlist(sb, event.season_id, rules) : [];

  // Individual results sorted
  let individualSorted = results.filter((r) => !r.did_not_play).slice();

  if (isFinal) {
    individualSorted.sort((a, b) => {
      const da = Number(a.adjusted_score ?? 999999);
      const db = Number(b.adjusted_score ?? 999999);
      if (da !== db) return da - db;
      const na = a.season_players?.people?.name ?? "";
      const nb = b.season_players?.people?.name ?? "";
      return na.localeCompare(nb);
    });
  } else {
    individualSorted.sort((a, b) => (a.placering ?? 999) - (b.placering ?? 999));
  }

  const sharedPlacingMap = isFinal ? computeSharedPlacings(individualSorted) : new Map<string, number>();

  // Team grouping (unchanged)
  const teams = new Map<
    number,
    {
      lag_nr: number;
      lag_score: number | null;
      placering: number | null;
      poang: number;
      players: Array<{ name: string; person_id: string; avatar_url: string | null }>;
    }
  >();

  if (isTeam && event.locked) {
    for (const r of results) {
      if (r.did_not_play) continue;
      const nr = r.lag_nr ?? 0;
      if (!nr) continue;

      if (!teams.has(nr)) {
        teams.set(nr, {
          lag_nr: nr,
          lag_score: r.lag_score ?? null,
          placering: r.placering ?? null,
          poang: Number(r.poang ?? 0),
          players: [],
        });
      }

      const t = teams.get(nr)!;
      t.lag_score = r.lag_score ?? t.lag_score;
      t.placering = r.placering ?? t.placering;
      t.poang = Number(r.poang ?? t.poang);

      const name = r.season_players?.people?.name ?? "Okänd";
      const person_id = r.season_players?.person_id ?? "";
      const avatar_url = r.season_players?.people?.avatar_url ?? null;

      if (person_id) t.players.push({ name, person_id, avatar_url });
    }
  }

  const teamSorted = Array.from(teams.values()).sort((a, b) => (a.placering ?? 999) - (b.placering ?? 999));

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href={`/events${seasonQuery}`} className="text-sm text-white/70 hover:underline">
          ← Till tävlingar
        </Link>

        <div className="flex items-center gap-2 text-xs text-white/70">
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
            {typeLabel(event.event_type)}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
            {event.locked ? "Spelad" : "Kommande"}
          </span>
        </div>
      </div>

      {/* Hero */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <CoverImage src={event.image_url} alt={event.course ?? event.name} />

        <div className="p-4 space-y-2">
          <h1 className="text-2xl font-semibold">{event.name}</h1>
          <div className="text-white/70">
            {fmtDateTimeLong(event.starts_at)} • {event.course ?? "Bana ej angiven"}
          </div>

          <div className="flex flex-wrap gap-2 pt-2 text-sm text-white/80">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">🌬️ {event.setting_wind ?? "—"}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              ⛳ {event.setting_tee_meters ? `${event.setting_tee_meters} m` : "—"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">📍 {event.setting_pins ?? "—"}</span>
          </div>
        </div>
      </section>

      {/* FINAL: prelim (NOT LOCKED) -> #, Spelare, Total, Startscore */}
      {isFinal && !event.locked && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="font-semibold">Preliminär startlista</h2>
          <p className="mt-2 text-sm text-white/60">
            Sorterad på <b>Startscore</b> (lägst först).
          </p>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-white/60">
                <tr className="border-b border-white/10">
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Spelare</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Startscore</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {prelim.map((r) => (
                  <tr key={r.person_id}>
                    <td className="px-3 py-2">{r.rank}</td>
                    <td className="px-3 py-2">
                      <Link href={`/players/${r.person_id}${seasonQuery}`} className="hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right">{r.total.toLocaleString("sv-SE")}</td>
                    <td className="px-3 py-2 text-right font-semibold">{r.start_incl_hcp}</td>
                  </tr>
                ))}

                {prelim.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-white/60">
                      Inga låsta tävlingar att basera startlistan på ännu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* FINAL: locked -> #, Spelare, Netto, Start (inkl PN-HCP), Brutto */}
      {isFinal && event.locked && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="font-semibold">Finalresultat</h2>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-white/60">
                <tr className="border-b border-white/10">
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Spelare</th>
                  <th className="px-3 py-2 text-right">Netto</th>
                  <th className="px-3 py-2 text-right">Start</th>
                  <th className="px-3 py-2 text-right">Brutto</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {individualSorted.map((r) => {
                  const name = r.season_players?.people?.name ?? "Okänd";
                  const personId = r.season_players?.person_id ?? "";

                  const pl = sharedPlacingMap.get(r.season_player_id) ?? r.placering ?? "—";
                  const netto = r.adjusted_score ?? null;

                  // ✅ ENDA LOGIKÄNDRINGEN: Start inkl PN-HCP (0/2/4)
                  const baseStart = startScoreMap.get(r.season_player_id) ?? 0;
                  const hcp = Number(r.season_players?.hcp ?? 0);
                  const pnHcp = hcpToStrokes(hcp, rules);
                  const start = baseStart - pnHcp;

                  return (
                    <tr key={r.season_player_id}>
                      <td className="px-3 py-2">{pl}</td>
                      <td className="px-3 py-2">
                        {personId ? (
                          <Link href={`/players/${personId}${seasonQuery}`} className="hover:underline">
                            {name}
                          </Link>
                        ) : (
                          name
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">{netto ?? "—"}</td>
                      <td className="px-3 py-2 text-right">{start}</td>
                      <td className="px-3 py-2 text-right">{r.gross_strokes ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* INFO over results (non-final) */}
      {!isFinal && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="font-semibold">Info</h2>
          <p className="mt-2 whitespace-pre-line text-white/70">
            {event.description ?? "Ingen beskrivning inlagd ännu."}
          </p>
        </section>
      )}

      {/* RESULTS (non-final) */}
      {!isFinal && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="font-semibold">Resultat</h2>

          {!event.locked ? (
            <p className="mt-2 text-white/70">Resultat visas här när tävlingen är spelad och låst.</p>
          ) : isTeam ? (
            <div className="mt-3 space-y-3">
              {teamSorted.map((t) => (
                <div key={t.lag_nr} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">Plats {t.placering ?? "—"} • Lag {t.lag_nr}</div>
                    <div className="text-sm text-white/80">
                      {t.lag_score ?? "—"} brutto • {t.poang.toLocaleString("sv-SE")} p/spelare
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 text-sm">
                    {t.players.map((p) => (
                      <Link
                        key={p.person_id}
                        href={`/players/${p.person_id}${seasonQuery}`}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 hover:bg-white/10"
                      >
                        {p.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-white/60">
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Spelare</th>
                    <th className="px-3 py-2 text-right">Netto</th>
                    <th className="px-3 py-2 text-right">Poäng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {individualSorted.map((r) => {
                    const name = r.season_players?.people?.name ?? "Okänd";
                    const personId = r.season_players?.person_id ?? "";
                    return (
                      <tr key={r.season_player_id}>
                        <td className="px-3 py-2">{r.placering ?? "—"}</td>
                        <td className="px-3 py-2">
                          {personId ? (
                            <Link href={`/players/${personId}${seasonQuery}`} className="hover:underline">
                              {name}
                            </Link>
                          ) : (
                            name
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">{r.net_strokes ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-semibold">{(r.poang ?? 0).toLocaleString("sv-SE")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}