"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type {
  OtherCompetitionConfig,
  OtherCompetitionPlayer,
  OtherCompetitionRound,
  OtherCompetitionRow,
  OtherCompetitionSchedulePairing,
  OtherCompetitionScoringModel,
  OtherCompetitionTeam,
} from "@/lib/otherCompetitions/types";
import { daysUntil, formatDateRange, statusLabel } from "@/lib/otherCompetitions/data";
import { formatLabel } from "@/lib/otherCompetitions/templates";
import {
  type Competitor,
  competitorsForRound,
  roundLeaderboard,
  scoringModelForUnit,
  scoringUnitsForRound,
  teamDisplayName,
  totalStandings,
} from "@/lib/otherCompetitions/scoring";

const TABS = ["overview", "standings", "schedule", "players", "rules"] as const;
type Tab = (typeof TABS)[number];

function tabLabel(tab: Tab) {
  if (tab === "overview") return "Översikt";
  if (tab === "standings") return "Tabell";
  if (tab === "schedule") return "Spelschema";
  if (tab === "players") return "Lag/Spelare";
  return "Stadgar";
}

function statusClass(status: string) {
  if (status === "live") return "border-sky-300/35 bg-sky-400/15 text-sky-100";
  if (status === "locked") return "border-emerald-300/35 bg-emerald-400/15 text-emerald-100";
  return "border-white/15 bg-black/35 text-white/85";
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  return (
    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-white/50">
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
  );
}

function MiniAvatar({ src, name }: { src: string | null; name: string }) {
  return (
    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border-2 border-[#070b14] bg-white/5">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[11px] text-white/58">
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
  );
}

function fmtPoints(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}

function formatRoundDate(value: string) {
  if (!value) return "Datum saknas";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
}

function earliestStartTime(round: OtherCompetitionRound) {
  const times = round.schedule
    .map((item) => item.time.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "sv"));
  return times[0] ?? "";
}

function scoringSummary(model: OtherCompetitionScoringModel) {
  if (model.kind === "placement" && model.placementPoints.length) {
    return "Tabellpoäng efter placering";
  }
  if (model.kind === "match") return `Match: ${model.winPoints}-${model.drawPoints}-${model.lossPoints}`;
  if (model.kind === "manual") return "Manuell tabellpoäng";
  return "Eget upplägg";
}

function placeLabel(index: number) {
  if (index === 0) return "1:a";
  if (index === 1) return "2:a";
  return `${index + 1}:e`;
}

function ScoringPointsTable({ model }: { model: OtherCompetitionScoringModel }) {
  if (model.kind === "placement") {
    return (
      <div className="overflow-hidden rounded-2xl border border-sky-200/15">
        <div className="grid grid-cols-2 bg-sky-300/10 px-3 py-2 text-xs uppercase tracking-[0.16em] text-sky-100/65">
          <div>Placering</div>
          <div className="text-right">Poäng</div>
        </div>
        {(model.placementPoints.length ? model.placementPoints : [6, 5, 4, 3, 2, 1]).map((points, index) => (
          <div key={index} className="grid grid-cols-2 border-t border-sky-200/10 px-3 py-2 text-sm">
            <div className="text-white/78">{placeLabel(index)}</div>
            <div className="text-right font-semibold tabular-nums text-white">{points}p</div>
          </div>
        ))}
      </div>
    );
  }

  if (model.kind === "match") {
    return (
      <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-sky-200/15 text-center text-sm">
        <div className="border-r border-sky-200/10 p-3">
          <div className="text-xs uppercase tracking-[0.14em] text-sky-100/55">Vinst</div>
          <div className="mt-1 font-semibold">{model.winPoints}p</div>
        </div>
        <div className="border-r border-sky-200/10 p-3">
          <div className="text-xs uppercase tracking-[0.14em] text-sky-100/55">Oavgjort</div>
          <div className="mt-1 font-semibold">{model.drawPoints}p</div>
        </div>
        <div className="p-3">
          <div className="text-xs uppercase tracking-[0.14em] text-sky-100/55">Förlust</div>
          <div className="mt-1 font-semibold">{model.lossPoints}p</div>
        </div>
      </div>
    );
  }

  return <div className="rounded-2xl border border-sky-200/15 px-3 py-3 text-sm text-white/72">{scoringSummary(model)}</div>;
}

function partFormatLabel(part: NonNullable<OtherCompetitionRound["parts"]>[number], round: OtherCompetitionRound) {
  return formatLabel(part.format ?? round.format, part.customFormatName);
}

function roundFormatSummary(round: OtherCompetitionRound) {
  const parts = (round.parts ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  if (parts.length > 0) return parts.map((part) => partFormatLabel(part, round)).join(" + ");
  return formatLabel(round.format, round.customFormatName);
}

function segmentLabel(segment: OtherCompetitionSchedulePairing["segment"]) {
  return segment === "front_9" ? "Första 9" : "Bakre 9";
}

function teamMembers(config: OtherCompetitionConfig, teamId: string) {
  const team = config.teams.find((item) => item.id === teamId);
  return (team?.memberIds ?? [])
    .map((id) => config.players.find((player) => player.id === id))
    .filter((player): player is OtherCompetitionPlayer => Boolean(player));
}

function sortedTeams(teams: OtherCompetitionTeam[]) {
  return teams.slice().sort((a, b) => a.sortOrder - b.sortOrder);
}

function teamCompetitor(config: OtherCompetitionConfig, team: OtherCompetitionTeam): Competitor {
  const members = teamMembers(config, team.id);
  return {
    id: team.id,
    type: "team",
    name: teamDisplayName(team, config.players),
    avatarUrl: members[0]?.avatarUrl ?? null,
    memberNames: members.map((member) => member.name),
    teamId: team.id,
    teamName: teamDisplayName(team, config.players),
    teamColor: team.color,
    teamIcon: team.icon ?? null,
  };
}

function scheduleCompetitorsForRound(config: OtherCompetitionConfig, round: OtherCompetitionRound) {
  if (round.format === "switch_match_9" && config.teams.length > 0) {
    return sortedTeams(config.teams).map((team) => teamCompetitor(config, team));
  }
  return competitorsForRound(config, round);
}

function playersForCompetitor(config: OtherCompetitionConfig, competitor: Competitor) {
  if (competitor.type === "team") return teamMembers(config, competitor.id);
  const player = config.players.find((item) => item.id === competitor.id);
  return player ? [player] : [];
}

function roundPointsFor(row: ReturnType<typeof totalStandings>[number], round: OtherCompetitionRound) {
  return scoringUnitsForRound(round).reduce((sum, unit) => sum + (row.roundPoints[unit.resultKey] ?? 0), 0);
}

function resultForCompetitorUnit(config: OtherCompetitionConfig, competitor: Competitor, unit: ReturnType<typeof scoringUnitsForRound>[number]) {
  const results = config.results[unit.resultKey] ?? [];
  if (unit.round.playMode === "team") return results.find((result) => result.competitorId === competitor.id);
  if (competitor.type === "player") return results.find((result) => result.competitorId === competitor.id);
  return teamMembers(config, competitor.id)
    .map((member) => results.find((result) => result.competitorId === member.id))
    .filter(Boolean)
    .at(0);
}

function roundResultLabel(config: OtherCompetitionConfig, competitor: Competitor, round: OtherCompetitionRound) {
  const labels = scoringUnitsForRound(round)
    .map((unit) => resultForCompetitorUnit(config, competitor, unit)?.scoreLabel)
    .filter((label): label is string => Boolean(label));
  return labels.join(" / ");
}

function playerResultForRound(config: OtherCompetitionConfig, round: OtherCompetitionRound, playerId: string) {
  for (const unit of scoringUnitsForRound(round)) {
    const result = (config.results[unit.resultKey] ?? []).find((item) => item.competitorId === playerId);
    if (result) return result;
  }
  return null;
}

function dayGroups(rounds: OtherCompetitionRound[]) {
  const groups: Array<{ key: string; label: string; rounds: OtherCompetitionRound[] }> = [];
  const byDate = new Map<string, OtherCompetitionRound[]>();

  for (const round of rounds) {
    const key = round.date || "no-date";
    byDate.set(key, [...(byDate.get(key) ?? []), round]);
  }

  Array.from(byDate.entries()).forEach(([key, items], index) => {
    groups.push({
      key,
      label: `Dag ${index + 1} - ${key === "no-date" ? "Datum saknas" : formatRoundDate(key)}`,
      rounds: items,
    });
  });

  return groups;
}

function TeamBadge({ competitor }: { competitor: Pick<Competitor, "teamName" | "teamColor" | "teamIcon" | "type"> }) {
  if (!competitor.teamName) return null;
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium text-white/86"
      style={{
        backgroundColor: `${competitor.teamColor ?? "#ffffff"}22`,
        borderColor: `${competitor.teamColor ?? "#ffffff"}66`,
      }}
    >
      <span aria-hidden>{competitor.teamIcon ?? "◆"}</span>
      <span className="truncate">{competitor.teamName}</span>
    </span>
  );
}

export default function OtherCompetitionPublicClient({
  initialCompetition,
}: {
  initialCompetition: OtherCompetitionRow;
}) {
  const [competition, setCompetition] = useState(initialCompetition);
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedScheduleRoundId, setSelectedScheduleRoundId] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/other-competitions/${competition.slug}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { competition?: OtherCompetitionRow };
        if (!cancelled && data.competition) {
          setCompetition(data.competition);
        }
      } catch {
        // Live polling is an enhancement; the server rendered page still works.
      }
    }

    const timer = window.setInterval(poll, 7000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [competition.slug]);

  const standings = useMemo(() => totalStandings(competition.config), [competition.config]);
  const nextCountdown = competition.status !== "locked" ? daysUntil(competition.starts_on) : null;
  const showCountdown = nextCountdown != null && nextCountdown > 0;
  const rounds = competition.config.rounds.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const groupedRounds = dayGroups(rounds);

  return (
    <main className="space-y-5">
      <section className="relative -mx-4 -mt-6 overflow-hidden bg-black/35 md:mx-0 md:mt-0 md:rounded-[28px] md:border md:border-white/10">
        <div className="h-[330px] md:h-[380px]">
          {competition.header_image_url || competition.card_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={competition.header_image_url ?? competition.card_image_url ?? ""}
              alt={competition.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/45">Headerbild saknas</div>
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-[#070b14]/45 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs ${statusClass(competition.status)}`}>
              {statusLabel(competition.status)}
            </span>
            {showCountdown ? (
              <span className="rounded-full border border-amber-300/30 bg-amber-300/15 px-3 py-1 text-xs text-amber-100">
                {nextCountdown} dagar kvar
              </span>
            ) : null}
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">{competition.name}</h1>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-white/72">
            <span>{formatDateRange(competition.starts_on, competition.ends_on)}</span>
            {competition.location ? <span>{competition.location}</span> : null}
          </div>
          {competition.subtitle ? (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/72">{competition.subtitle}</p>
          ) : null}
        </div>
      </section>

      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={[
              "h-10 shrink-0 rounded-xl border px-4 text-sm font-medium transition",
              tab === item
                ? "border-white/25 bg-white/12 text-white"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
            ].join(" ")}
          >
            {tabLabel(item)}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-white/45">Ledare</div>
            <div className="mt-3 text-2xl font-semibold">{standings[0]?.competitor.name ?? "Ingen tabell ännu"}</div>
            <div className="mt-1 text-sm text-white/58">
              {standings[0] ? `${fmtPoints(standings[0].total)} poäng` : "Fylls när resultat matas in"}
            </div>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-white/45">Speldagar</div>
            <div className="mt-3 text-2xl font-semibold">{rounds.length}</div>
            <div className="mt-1 text-sm text-white/58">Valfritt format per speldag</div>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-white/45">Deltagare</div>
            <div className="mt-3 text-2xl font-semibold">{competition.config.players.length}</div>
            <div className="mt-1 text-sm text-white/58">{competition.config.teams.length} lag</div>
          </div>
        </section>
      ) : null}

      {tab === "standings" ? (
        <section className="grid gap-3">
          <div className="hidden grid-cols-[58px_minmax(0,1fr)_repeat(var(--rounds),72px)_86px] rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-xs uppercase tracking-[0.14em] text-white/42 md:grid">
            <div>Pl</div>
            <div>Lag</div>
            {rounds.map((round) => (
              <div key={round.id} className="text-right">
                R{round.sortOrder + 1}
              </div>
            ))}
            <div className="text-right">Total</div>
          </div>
          <div className="grid gap-3">
            {standings.map((row) => (
              <div
                key={row.competitor.id}
                className="rounded-[22px] border border-white/10 bg-white/[0.04] p-3 md:grid md:grid-cols-[58px_minmax(0,1fr)_repeat(var(--rounds),72px)_86px] md:items-center md:gap-0"
                style={{ "--rounds": rounds.length } as CSSProperties}
              >
                <div className="flex items-center justify-between gap-3 md:block">
                  <div className="font-semibold tabular-nums text-white/86">
                    {row.placement ?? "-"}
                    {row.overridden ? <span className="ml-1 text-[10px] text-amber-200">*</span> : null}
                  </div>
                  <div className="text-right text-2xl font-semibold tabular-nums md:hidden">{fmtPoints(row.total)}</div>
                </div>
                <div className="mt-3 flex min-w-0 items-center gap-3 md:mt-0">
                  <div className="flex shrink-0 -space-x-2">
                    {playersForCompetitor(competition.config, row.competitor).slice(0, 2).map((player) => (
                      <MiniAvatar key={player.id} src={player.avatarUrl} name={player.name} />
                    ))}
                    {playersForCompetitor(competition.config, row.competitor).length === 0 ? (
                      <Avatar src={row.competitor.avatarUrl} name={row.competitor.name} />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      {row.competitor.type === "team" && row.competitor.teamColor ? (
                        <span
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs"
                          style={{
                            backgroundColor: `${row.competitor.teamColor}33`,
                            borderColor: `${row.competitor.teamColor}88`,
                          }}
                          aria-hidden
                        >
                          {row.competitor.teamIcon ?? "◆"}
                        </span>
                      ) : null}
                      <div className="truncate font-semibold">{row.competitor.name}</div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:contents">
                  {rounds.map((round) => {
                    const points = roundPointsFor(row, round);
                    const label = roundResultLabel(competition.config, row.competitor, round);
                    return (
                      <div key={round.id} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 md:border-0 md:bg-transparent md:p-0 md:text-right">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-white/38 md:hidden">R{round.sortOrder + 1}</div>
                        <div className="font-semibold tabular-nums">{fmtPoints(points)}</div>
                        {label ? <div className="truncate text-xs text-white/45 md:hidden">{label}</div> : null}
                      </div>
                    );
                  })}
                </div>
                <div className="hidden text-right text-lg font-semibold tabular-nums md:block">
                  {fmtPoints(row.total)}
                </div>
                <div className="hidden">
                  {row.placement ?? "-"}
                  {row.overridden ? <span className="ml-1 text-[10px] text-amber-200">*</span> : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "schedule" ? (
        <section className="grid gap-5">
          {groupedRounds.map((group) => (
            <div key={group.key} className="space-y-3">
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">{group.label}</div>
              <div className="grid gap-3 md:grid-cols-2">
                {group.rounds.map((round) => {
                  const units = scoringUnitsForRound(round);
                  const firstStart = earliestStartTime(round);
                  const selected = selectedScheduleRoundId === round.id;
                  const rows = roundLeaderboard(competition.config, round);
                  const competitors = new Map(scheduleCompetitorsForRound(competition.config, round).map((item) => [item.id, item]));
                  const players = new Map(competitorsForRound(competition.config, round).map((item) => [item.id, item]));

                  return (
                    <div
                      key={round.id}
                      className={[
                        "overflow-hidden rounded-[22px] border bg-white/[0.04]",
                        selected ? "border-sky-300/35" : "border-white/10",
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedScheduleRoundId(selected ? "" : round.id)}
                        className="block w-full p-4 text-left transition hover:bg-white/[0.04]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="truncate text-xl font-semibold">{round.name}</h2>
                            <div className="mt-1 text-sm text-white/58">
                              {roundFormatSummary(round)} · {round.holes} hål ·{" "}
                              {round.playMode === "team" ? "Lag" : "Individuellt"}
                            </div>
                          </div>
                          <div className="shrink-0 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">Start</div>
                            <div className="text-sm font-semibold tabular-nums text-white/86">{firstStart || "--"}</div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-white/68">
                            {round.schedule.length} bollar
                          </span>
                          <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-white/68">
                            {units.length > 1 ? `${units.length} poängdelar` : scoringSummary(round.scoringModel)}
                          </span>
                        </div>
                      </button>

                      {selected ? (
                        <div className="border-t border-white/10 p-4">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                              <div className="text-xs uppercase tracking-[0.18em] text-white/42">Format</div>
                              <div className="mt-2 font-semibold">{roundFormatSummary(round)}</div>
                              <div className="mt-1 text-sm text-white/58">
                                {round.playMode === "team" ? "Lagspel" : "Individuellt"} · {round.holes} hål
                              </div>
                            </div>
                            <div className="rounded-2xl border border-sky-300/15 bg-sky-400/10 p-3">
                              <div className="text-xs uppercase tracking-[0.18em] text-sky-100/70">Poäng på spel</div>
                              <div className="mt-3 grid gap-3">
                                {units.map((unit) => (
                                  <div key={unit.resultKey} className="grid gap-2">
                                    <div className="flex items-center justify-between gap-3 text-sm">
                                      <span className="font-medium text-white/82">{unit.part ? unit.label : "Hela rundan"}</span>
                                      <span className="text-right text-white/58">
                                        {unit.part ? partFormatLabel(unit.part, round) : scoringSummary(scoringModelForUnit(unit))}
                                      </span>
                                    </div>
                                    <ScoringPointsTable model={scoringModelForUnit(unit)} />
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-2">
                            {round.schedule.map((item) => (
                              <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="font-semibold">{item.title || "Boll/match"}</div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {item.competitorIds.map((id) => {
                                        const competitor = competitors.get(id);
                                        return competitor ? (
                                          <span key={id} className="rounded-2xl border border-white/10 bg-white/5 px-2.5 py-1 text-sm text-white/78">
                                            {competitor.name}
                                            {competitor.type === "player" && competitor.teamName ? (
                                              <span className="ml-2 inline-flex align-middle">
                                                <TeamBadge competitor={competitor} />
                                              </span>
                                            ) : null}
                                          </span>
                                        ) : (
                                          <span key={id} className="rounded-2xl border border-white/10 bg-white/5 px-2.5 py-1 text-sm text-white/58">
                                            {id}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  <div className="shrink-0 text-sm font-semibold tabular-nums text-white/82">
                                    {item.time || "--"}
                                  </div>
                                </div>
                                {round.format === "switch_match_9" && (item.pairings ?? []).length > 0 ? (
                                  <div className="mt-3 grid gap-3 border-t border-white/10 pt-3">
                                    {(["front_9", "back_9"] as const).map((segment) => {
                                      const pairings = (item.pairings ?? []).filter((pairing) => pairing.segment === segment);
                                      if (pairings.length === 0) return null;
                                      return (
                                        <div key={segment} className="grid gap-2">
                                          <div className="text-xs uppercase tracking-[0.16em] text-white/42">{segmentLabel(segment)}</div>
                                          {pairings.map((pairing) => (
                                            <div key={pairing.id} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                              <div className="flex flex-wrap items-center gap-2">
                                                {pairing.playerIds.map((playerId, index) => {
                                                  const competitor = players.get(playerId);
                                                  const result = playerResultForRound(competition.config, round, playerId);
                                                  return (
                                                    <span key={`${pairing.id}-${playerId}`} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-sm">
                                                      <span>{competitor?.name ?? playerId}</span>
                                                      {result ? (
                                                        <span className="text-xs text-sky-100/80">
                                                          {result.scoreLabel ? `${result.scoreLabel} · ` : ""}
                                                          {fmtPoints(result.points)}p
                                                        </span>
                                                      ) : null}
                                                      {index === 0 && pairing.playerIds.length > 1 ? <span className="text-white/35">vs</span> : null}
                                                    </span>
                                                  );
                                                })}
                                              </div>
                                              {pairing.resultLabel ? <div className="mt-2 text-sm text-white/58">{pairing.resultLabel}</div> : null}
                                            </div>
                                          ))}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : null}
                                {item.note ? <div className="mt-2 text-sm text-white/55">{item.note}</div> : null}
                              </div>
                            ))}
                            {round.schedule.length === 0 ? (
                              <div className="rounded-2xl border border-dashed border-white/10 px-3 py-5 text-center text-white/52">
                                Inget schema publicerat för rundan.
                              </div>
                            ) : null}
                          </div>

                          {rows.some((row) => row.points !== 0 || row.result?.scoreLabel) ? (
                            <div className="mt-4 border-t border-white/10 pt-4">
                              <div className="mb-2 text-xs uppercase tracking-[0.18em] text-white/42">Ställning i denna runda</div>
                              <div className="grid gap-2">
                                {rows.slice(0, 6).map((row) => (
                                  <div key={row.competitor.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                                    <div className="min-w-0">
                                      <span className="mr-2 text-white/50">{row.placement ?? "-"}</span>
                                      <span className="font-medium">{row.competitor.name}</span>
                                      {row.competitor.type === "player" && row.competitor.teamName ? (
                                        <span className="ml-2 inline-flex align-middle">
                                          <TeamBadge competitor={row.competitor} />
                                        </span>
                                      ) : null}
                                      {row.result?.scoreLabel ? (
                                        <div className="mt-1 truncate text-xs text-white/45">{row.result.scoreLabel}</div>
                                      ) : null}
                                    </div>
                                    <div className="font-semibold tabular-nums">{fmtPoints(row.points)}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {rounds.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-white/10 px-4 py-8 text-center text-white/58">
              Inget spelschema publicerat ännu.
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "players" ? (
        <section className="grid gap-4 md:grid-cols-2">
          {competition.config.teams.length > 0
            ? competition.config.teams.map((team) => {
                const members = team.memberIds
                  .map((id) => competition.config.players.find((player) => player.id === id))
                  .filter(Boolean) as OtherCompetitionPlayer[];
                const targetSize = Math.max(1, Number(team.targetSize ?? 0) || members.length || 1);
                return (
                  <div key={team.id} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 text-lg font-semibold"
                        style={{ backgroundColor: `${team.color}33`, borderColor: `${team.color}88` }}
                      >
                        {team.icon ?? "◆"}
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-xl font-semibold">
                          {team.name || teamDisplayName(team, competition.config.players) || "Lag"}
                        </h2>
                        <div className="text-xs text-white/50">
                          {members.length}/{targetSize} platser
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {members.map((member) =>
                        member ? (
                          <div key={member.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                            <Avatar src={member.avatarUrl} name={member.name} />
                            <span className="font-medium">{member.name}</span>
                          </div>
                        ) : null
                      )}
                      {Array.from({ length: Math.max(0, targetSize - members.length) }).map((_, index) => (
                        <div key={`${team.id}-empty-${index}`} className="rounded-2xl border border-dashed border-white/10 px-3 py-2 text-sm text-white/42">
                          Tom plats {members.length + index + 1}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            : competition.config.players.map((player) => (
                <div key={player.id} className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                  <Avatar src={player.avatarUrl} name={player.name} />
                  <div>
                    <div className="font-semibold">{player.name}</div>
                    <div className="text-xs text-white/50">
                      {player.sourceLabel === "postnord" ? "Importerad snapshot" : "Extern spelare"}
                    </div>
                  </div>
                </div>
              ))}
        </section>
      ) : null}

      {tab === "rules" ? (
        <section className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5">
          <div className="prose prose-invert max-w-none whitespace-pre-wrap text-sm leading-7 text-white/76">
            {competition.rules_content || "Inga stadgar är publicerade ännu."}
          </div>
        </section>
      ) : null}
    </main>
  );
}
