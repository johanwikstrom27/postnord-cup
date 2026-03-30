export const runtime = "nodejs";

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";
import { resolvePublicSeason } from "@/lib/publicSeason";

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

// Troféskåp: vinster i alla säsonger
type TrophyWinRow = {
  event_id: string;
  poang: number | null;
  events: {
    id: string;
    season_id: string;
    name: string;
    event_type: string;
    starts_at: string;
    locked: boolean;
  } | null;
};

type TrophyEventRow = {
  id: string;
  season_id: string;
  name: string;
  event_type: string;
  starts_at: string;
  locked: boolean;
};

type TrophyWinRespRow = {
  event_id: string;
  poang: number | null;
  events: TrophyEventRow | TrophyEventRow[] | null;
};

type SeasonPlayerIdRow = { id: string };
type PersonSeasonPlayerRow = { id: string; season_id: string; person_id: string };
type SeasonMetaRow = { id: string; name: string; created_at: string; is_published: boolean | null };
type SeasonRuleRow = {
  season_id: string;
  vanlig_best_of: number | null;
  major_best_of: number | null;
  lagtavling_best_of: number | null;
};
type SeasonEventRow = {
  id: string;
  season_id: string;
  event_type: string;
  locked: boolean;
  starts_at: string;
};
type SeasonPlayerSummaryResultRow = {
  season_player_id: string;
  event_id: string;
  poang: number | null;
  placering: number | null;
  did_not_play: boolean;
  events: { id: string; season_id: string; event_type: string; locked: boolean } | null;
};
type SeasonPlayerSummaryResultRespRow = {
  season_player_id: string;
  event_id: string;
  poang: number | null;
  placering: number | null;
  did_not_play: boolean;
  events:
    | { id: string; season_id: string; event_type: string; locked: boolean }
    | Array<{ id: string; season_id: string; event_type: string; locked: boolean }>
    | null;
};
type SeasonHistoryCard = {
  seasonId: string;
  seasonName: string;
  seasonYear: number;
  finalPlaceLabel: string;
  finalPlaceTone: string;
  baseRankLabel: string;
  trophies: number;
  podiums: number;
  participationLabel: string;
  averagePlaceLabel: string;
};

function typeLabel(t: string) {
  if (t === "VANLIG") return "Vanlig";
  if (t === "MAJOR") return "Major";
  if (t === "LAGTÄVLING") return "Lagtävling";
  if (t === "FINAL") return "Final";
  return t;
}

function iconForType(t: string) {
  if (t === "FINAL") return "/icons/final-1.png";
  if (t === "MAJOR") return "/icons/major-1.png";
  if (t === "LAGTÄVLING") return "/icons/lagtavling-1.png";
  return "/icons/vanlig-1.png";
}

// ✅ ENDA versionen av denna (inga dubletter)
function fmtShortDateWithYear(iso: string) {
  const d = new Date(iso);
  // Ex: "18 jan. 2026"
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
}

function fmtInt(n: number) {
  return n.toLocaleString("sv-SE");
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

/* ===========================
   Troféskåp UI
=========================== */
function TrophySlot({
  label,
  count,
  iconSrc,
  big,
}: {
  label: string;
  count: number;
  iconSrc: string;
  big?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-end text-center">
      <div className={big ? "h-16 w-16" : "h-12 w-12"}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconSrc} alt={label} className="h-full w-full object-contain drop-shadow" />
      </div>
      <div className="mt-2 text-xs text-white/70">{label}</div>
      <div className="mt-1 inline-flex items-center justify-center rounded-md border border-white/10 bg-black/25 px-2 py-0.5 text-xs font-semibold tabular-nums">
        {count}
      </div>
    </div>
  );
}

function seasonYear(name: string) {
  const match = name.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : 0;
}

function rankFromTotals(items: Array<{ id: string; total: number }>) {
  const sorted = items.slice().sort((a, b) => b.total - a.total);
  const rankById = new Map<string, number>();

  let currentRank = 1;
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i].total < sorted[i - 1].total) {
      currentRank = i + 1;
    }
    rankById.set(sorted[i].id, currentRank);
  }

  return rankById;
}

function finalPlaceTone(label: string) {
  if (label === "#1") return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  if (label === "#2") return "border-slate-300/30 bg-slate-300/10 text-slate-100";
  if (label === "#3") return "border-orange-300/30 bg-orange-300/10 text-orange-100";
  if (label === "DNS") return "border-red-400/20 bg-red-400/10 text-red-200";
  if (label === "Ej final") return "border-white/10 bg-white/5 text-white/60";
  return "border-white/10 bg-white/5 text-white/80";
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

  const season = await resolvePublicSeason(sb, requestedSeasonId);
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

  // personprofil
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

  /* ===========================
     Troféskåp-data (alla säsonger)
  ============================ */
  const allSpResp = await sb.from("season_players").select("id").eq("person_id", personId);
  const allSeasonPlayerIds = ((allSpResp.data ?? []) as SeasonPlayerIdRow[]).map((x) => String(x.id));

  let winRows: TrophyWinRow[] = [];
  if (allSeasonPlayerIds.length) {
    const wResp = await sb
      .from("results")
      .select("event_id,poang,events(id,season_id,name,event_type,starts_at,locked)")
      .in("season_player_id", allSeasonPlayerIds)
      .eq("placering", 1)
      .eq("did_not_play", false);

    winRows = ((wResp.data ?? []) as TrophyWinRespRow[]).map((row) => ({
      ...row,
      events: Array.isArray(row.events) ? row.events[0] ?? null : row.events ?? null,
    })) as TrophyWinRow[];
  }

  const lockedWins = winRows.filter((w) => w.events?.locked === true && !!w.events?.starts_at);

  const winCount = {
    FINAL: lockedWins.filter((w) => w.events?.event_type === "FINAL").length,
    MAJOR: lockedWins.filter((w) => w.events?.event_type === "MAJOR").length,
    LAGTÄVLING: lockedWins.filter((w) => w.events?.event_type === "LAGTÄVLING").length,
    VANLIG: lockedWins.filter((w) => w.events?.event_type === "VANLIG").length,
  };

  const last3Wins = lockedWins
    .slice()
    .sort((a, b) => new Date(b.events!.starts_at).getTime() - new Date(a.events!.starts_at).getTime())
    .slice(0, 3);

  /* ===========================
     Säsongshistorik (alla publicerade säsonger)
  ============================ */
  const allPersonSpResp = await sb
    .from("season_players")
    .select("id,season_id,person_id")
    .eq("person_id", personId);

  const personSeasonPlayers = (allPersonSpResp.data ?? []) as PersonSeasonPlayerRow[];
  const allSeasonIds = Array.from(new Set(personSeasonPlayers.map((row) => String(row.season_id))));

  let seasonHistoryCards: SeasonHistoryCard[] = [];

  if (allSeasonIds.length) {
    const [seasonMetaResp, allSeasonPlayersResp, seasonRulesResp, seasonEventsResp] = await Promise.all([
      sb.from("seasons").select("id,name,created_at,is_published").in("id", allSeasonIds),
      sb.from("season_players").select("id,season_id,person_id").in("season_id", allSeasonIds),
      sb
        .from("season_rules")
        .select("season_id,vanlig_best_of,major_best_of,lagtavling_best_of")
        .in("season_id", allSeasonIds),
      sb
        .from("events")
        .select("id,season_id,event_type,locked,starts_at")
        .in("season_id", allSeasonIds),
    ]);

    const publishedSeasons = ((seasonMetaResp.data ?? []) as SeasonMetaRow[]).filter(
      (seasonMeta) => seasonMeta.is_published === true
    );
    const publishedSeasonIds = new Set(publishedSeasons.map((seasonMeta) => String(seasonMeta.id)));

    const allSeasonPlayers = ((allSeasonPlayersResp.data ?? []) as PersonSeasonPlayerRow[]).filter((row) =>
      publishedSeasonIds.has(String(row.season_id))
    );
    const allSeasonPlayerIds = allSeasonPlayers.map((row) => String(row.id));

    let allSeasonResults: SeasonPlayerSummaryResultRow[] = [];
    if (allSeasonPlayerIds.length) {
      const allSeasonResultsResp = await sb
        .from("results")
        .select("season_player_id,event_id,poang,placering,did_not_play,events(id,season_id,event_type,locked)")
        .in("season_player_id", allSeasonPlayerIds);

      allSeasonResults = ((allSeasonResultsResp.data ?? []) as SeasonPlayerSummaryResultRespRow[]).map((row) => ({
        ...row,
        events: Array.isArray(row.events) ? row.events[0] ?? null : row.events ?? null,
      })) as SeasonPlayerSummaryResultRow[];
    }

    const seasonRulesBySeason = new Map<string, SeasonRuleRow>();
    for (const rule of (seasonRulesResp.data ?? []) as SeasonRuleRow[]) {
      seasonRulesBySeason.set(String(rule.season_id), rule);
    }

    const seasonEventsBySeason = new Map<string, SeasonEventRow[]>();
    for (const event of (seasonEventsResp.data ?? []) as SeasonEventRow[]) {
      if (!publishedSeasonIds.has(String(event.season_id))) continue;
      const arr = seasonEventsBySeason.get(String(event.season_id)) ?? [];
      arr.push(event);
      seasonEventsBySeason.set(String(event.season_id), arr);
    }

    const resultsBySeasonPlayer = new Map<string, SeasonPlayerSummaryResultRow[]>();
    for (const result of allSeasonResults) {
      const arr = resultsBySeasonPlayer.get(String(result.season_player_id)) ?? [];
      arr.push(result);
      resultsBySeasonPlayer.set(String(result.season_player_id), arr);
    }

    seasonHistoryCards = publishedSeasons
      .filter((seasonMeta) => personSeasonPlayers.some((row) => String(row.season_id) === String(seasonMeta.id)))
      .map((seasonMeta) => {
        const sid = String(seasonMeta.id);
        const rulesForSeason = seasonRulesBySeason.get(sid) ?? {
          season_id: sid,
          vanlig_best_of: 4,
          major_best_of: 3,
          lagtavling_best_of: 2,
        };

        const playersInSeason = allSeasonPlayers.filter((row) => String(row.season_id) === sid);
        const eventsInSeason = (seasonEventsBySeason.get(sid) ?? []).slice();
        const lockedEvents = eventsInSeason.filter((event) => event.locked);
        const finalEvent = lockedEvents.find((event) => event.event_type === "FINAL") ?? null;

        const totals = playersInSeason.map((playerRow) => {
          const bucket = { vanlig: [] as number[], major: [] as number[], lag: [] as number[] };
          const playerResults = (resultsBySeasonPlayer.get(String(playerRow.id)) ?? []).filter(
            (result) => result.events?.locked === true && result.did_not_play !== true
          );

          for (const result of playerResults) {
            const eventType = String(result.events?.event_type ?? "");
            const points = Number(result.poang ?? 0);
            if (eventType === "VANLIG") bucket.vanlig.push(points);
            else if (eventType === "MAJOR") bucket.major.push(points);
            else if (eventType === "LAGTÄVLING") bucket.lag.push(points);
          }

          return {
            id: String(playerRow.id),
            total:
              sumTopN(bucket.vanlig, Number(rulesForSeason.vanlig_best_of ?? 4)) +
              sumTopN(bucket.major, Number(rulesForSeason.major_best_of ?? 3)) +
              sumTopN(bucket.lag, Number(rulesForSeason.lagtavling_best_of ?? 2)),
          };
        });

        const seriesRankById = rankFromTotals(totals);
        const subjectSeasonPlayerIds = personSeasonPlayers
          .filter((row) => String(row.season_id) === sid)
          .map((row) => String(row.id));

        const subjectResults = subjectSeasonPlayerIds.flatMap((seasonPlayerIdItem) =>
          (resultsBySeasonPlayer.get(seasonPlayerIdItem) ?? []).filter((result) => result.events?.locked === true)
        );

        const wins = subjectResults.filter(
          (result) => result.did_not_play !== true && Number(result.placering ?? 999) === 1
        ).length;
        const podiums = subjectResults.filter(
          (result) =>
            result.did_not_play !== true &&
            typeof result.placering === "number" &&
            result.placering >= 1 &&
            result.placering <= 3
        ).length;
        const playedCount = subjectResults.filter((result) => result.did_not_play !== true).length;
        const totalLockedEvents = lockedEvents.length;
        const placingValues = subjectResults
          .filter(
            (result): result is SeasonPlayerSummaryResultRow & { placering: number } =>
              result.did_not_play !== true && typeof result.placering === "number"
          )
          .map((result) => result.placering);

        const finalResult = finalEvent
          ? subjectResults.find((result) => String(result.event_id) === String(finalEvent.id)) ?? null
          : null;

        const finalPlaceLabel = !finalEvent
          ? "Pågår"
          : !finalResult
          ? "Ej final"
          : finalResult.did_not_play
          ? "DNS"
          : typeof finalResult.placering === "number"
          ? `#${finalResult.placering}`
          : "Ej final";

        const baseRank = seriesRankById.get(subjectSeasonPlayerIds[0] ?? "") ?? null;

        return {
          seasonId: sid,
          seasonName: seasonMeta.name,
          seasonYear: seasonYear(seasonMeta.name),
          finalPlaceLabel,
          finalPlaceTone: finalPlaceTone(finalPlaceLabel),
          baseRankLabel: baseRank ? `#${baseRank}` : "—",
          trophies: wins,
          podiums,
          participationLabel: `${playedCount}/${totalLockedEvents || 0} tävlingar`,
          averagePlaceLabel: placingValues.length
            ? (placingValues.reduce((sum, value) => sum + value, 0) / placingValues.length).toFixed(1)
            : "—",
        };
      })
      .sort((a, b) => b.seasonYear - a.seasonYear);
  }

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
            <div className="text-xs text-white/60">Totalpoäng</div>
            <div className="text-2xl font-bold">{totalCounted.toLocaleString("sv-SE")}</div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
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
                        {typeLabel(et)} • {fmtShortDateWithYear(r.events!.starts_at)}
                      </div>
                    </div>

                    <div className="text-right text-sm">
                      <div className="font-semibold">{resultText}</div>
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

      {/* ✅ Profilinfo från admin */}
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

      {/* ✅ Troféskåp längst ner */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-semibold">Troféskåp</h2>
            <span className="text-sm font-medium text-white/55">Alla säsonger</span>
          </div>
          <div className="text-xs text-white/60"></div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="grid grid-cols-4 gap-4 items-end">
            <TrophySlot label="Final" count={winCount.FINAL} iconSrc="/icons/final-1.png" big />
            <TrophySlot label="Major" count={winCount.MAJOR} iconSrc="/icons/major-1.png" />
            <TrophySlot label="Lagtävling" count={winCount.LAGTÄVLING} iconSrc="/icons/lagtavling-1.png" />
            <TrophySlot label="Vanlig" count={winCount.VANLIG} iconSrc="/icons/vanlig-1.png" />
          </div>

          <div className="mt-4 h-[2px] w-full rounded-full bg-gradient-to-r from-white/10 via-white/20 to-white/10" />

          <div className="mt-4">
            <div className="text-sm font-semibold text-white/90">Senaste vinster</div>

            <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
              {last3Wins.length ? (
                last3Wins.map((w, idx) => {
                  const ev = w.events!;
                  const href = `/events/${ev.id}?season=${encodeURIComponent(ev.season_id)}`;
                  const icon = iconForType(ev.event_type);

                  return (
                    <Link
                      key={`${ev.id}-${idx}`}
                      href={href}
                      className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 last:border-b-0 hover:bg-white/5 transition"
                      title="Öppna tävling"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={icon} alt={typeLabel(ev.event_type)} className="h-6 w-6 object-contain shrink-0" />

                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {typeLabel(ev.event_type)} — {ev.name}
                          </div>
                          <div className="text-xs text-white/60">{fmtShortDateWithYear(ev.starts_at)}</div>
                        </div>
                      </div>

                      <div className="text-sm text-white/70 tabular-nums shrink-0">
                        {fmtInt(Number(w.poang ?? 0))} p
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="px-4 py-4 text-white/60 text-sm">Inga vinster ännu.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold">Säsongshistorik</h2>
          <span className="text-sm font-medium text-white/55">Alla säsonger</span>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
          {seasonHistoryCards.length ? (
            seasonHistoryCards.map((seasonCard) => (
              <div
                key={seasonCard.seasonId}
                className="border-b border-white/10 px-4 py-3.5 last:border-b-0 sm:px-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white sm:text-base">
                      {seasonCard.seasonName}
                    </div>
                  </div>

                  <div
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold sm:text-xs ${seasonCard.finalPlaceTone}`}
                  >
                    Final {seasonCard.finalPlaceLabel}
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                  <div className="rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">Grundserie</div>
                    <div className="mt-1 text-sm font-semibold text-white">{seasonCard.baseRankLabel}</div>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">Deltagit</div>
                    <div className="mt-1 text-sm font-semibold text-white">{seasonCard.participationLabel}</div>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">Pokaler</div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {seasonCard.trophies.toLocaleString("sv-SE")}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">Pallplatser</div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {seasonCard.podiums.toLocaleString("sv-SE")}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">Snittplacering</div>
                    <div className="mt-1 text-sm font-semibold text-white">{seasonCard.averagePlaceLabel}</div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-5 text-sm text-white/60">Ingen säsongshistorik ännu.</div>
          )}
        </div>
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
