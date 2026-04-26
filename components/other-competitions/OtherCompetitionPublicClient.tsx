"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type {
  OtherCompetitionConfig,
  OtherCompetitionPlayer,
  OtherCompetitionResult,
  OtherCompetitionRound,
  OtherCompetitionRow,
  OtherCompetitionSchedulePairing,
  OtherCompetitionScoringModel,
  OtherCompetitionTeam,
} from "@/lib/otherCompetitions/types";
import { daysUntil, formatDateRange, statusLabel } from "@/lib/otherCompetitions/data";
import { buildCompetitionRulesDraft } from "@/lib/otherCompetitions/rulesDraft";
import { defaultResultDisplayForFormat, formatLabel } from "@/lib/otherCompetitions/templates";
import {
  type Competitor,
  competitorsForRound,
  derivedIndividualMatchResultForUnit,
  derivedTeamMatchResultForUnit,
  rankEntries,
  roundLeaderboard,
  scoringModelForUnit,
  scoringUnitsForRound,
  teamDisplayName,
  totalStandings,
} from "@/lib/otherCompetitions/scoring";

const BASE_TABS = ["standings", "schedule", "players", "rules"] as const;
type BaseTab = (typeof BASE_TABS)[number];
type Tab = "podium" | BaseTab;

function tabLabel(tab: Tab) {
  if (tab === "podium") return "Prispall";
  if (tab === "standings") return "Tabell";
  if (tab === "schedule") return "Spelschema";
  if (tab === "players") return "Lag";
  return "Stadgar";
}

function statusClass(status: string) {
  if (status === "live") return "border-sky-300/35 bg-sky-400/15 text-sky-100";
  if (status === "locked") return "border-emerald-300/35 bg-emerald-400/15 text-emerald-100";
  return "border-white/15 bg-black/35 text-white/85";
}

function Avatar({ src, name, glowColor }: { src: string | null; name: string; glowColor?: string | null }) {
  return (
    <div
      className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5"
      style={
        glowColor
          ? {
              boxShadow: `0 0 0 2px ${glowColor}55, 0 0 18px ${glowColor}55`,
            }
          : undefined
      }
    >
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

function MiniAvatar({ src, name, glowColor }: { src: string | null; name: string; glowColor?: string | null }) {
  return (
    <div
      className="h-7 w-7 shrink-0 overflow-hidden rounded-full border-2 border-[#070b14] bg-white/5"
      style={
        glowColor
          ? {
              boxShadow: `0 0 0 1px ${glowColor}66, 0 0 14px ${glowColor}66`,
            }
          : undefined
      }
    >
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

function fmtTablePoints(value: number) {
  return `${fmtPoints(value)}p`;
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
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
    return "Poäng utifrån tabellplacering";
  }
  if (model.kind === "match") return `Match: ${model.winPoints}-${model.drawPoints}-${model.lossPoints}`;
  if (model.kind === "manual") return "Manuell tabellpoäng";
  return "Eget upplägg";
}

function resolvedResultDisplay(format: OtherCompetitionRound["format"], model: OtherCompetitionScoringModel) {
  return model.resultDisplay ?? defaultResultDisplayForFormat(format);
}

function resultValueSuffix(format: OtherCompetitionRound["format"], model: OtherCompetitionScoringModel) {
  if (model.kind === "match") return resolvedResultDisplay(format, model) === "points" ? " p" : "";
  return (model.placementMetric ?? "points") === "strokes" ? " slag" : " p";
}

function usesScoreComparedTeamMatchResults(
  round: OtherCompetitionRound,
  format: OtherCompetitionRound["format"],
  model: OtherCompetitionScoringModel
) {
  return round.playMode === "team" && format === "best_ball" && model.kind === "match" && resolvedResultDisplay(format, model) === "points";
}

function scoreComparedResultText(value: number | null, format: OtherCompetitionRound["format"], model: OtherCompetitionScoringModel) {
  if (value == null || !Number.isFinite(value)) return "";
  return `${fmtPoints(value)}${resultValueSuffix(format, model)}`;
}

function itemScoreComparedLabels(
  config: OtherCompetitionConfig,
  round: OtherCompetitionRound,
  item: { competitorIds: string[] },
  units: ReturnType<typeof scoringUnitsForRound>
) {
  return units
    .map((unit) => {
      const format = unit.part?.format ?? round.format;
      const model = scoringModelForUnit(unit);
      if (!usesScoreComparedTeamMatchResults(round, format, model)) return null;
      const [teamAId, teamBId] = item.competitorIds;
      if (!teamAId || !teamBId) return null;
      const teamNamesById = new Map(competitorsForRound(config, round).map((competitor) => [competitor.id, competitor.name]));
      const resultsById = new Map<string, OtherCompetitionResult>((config.results[unit.resultKey] ?? []).map((result) => [result.competitorId, result]));
      const teamAResult = resultsById.get(teamAId);
      const teamBResult = resultsById.get(teamBId);
      const teamAScore = typeof teamAResult?.rawScore === "number" && Number.isFinite(teamAResult.rawScore) ? teamAResult.rawScore : null;
      const teamBScore = typeof teamBResult?.rawScore === "number" && Number.isFinite(teamBResult.rawScore) ? teamBResult.rawScore : null;
      const scoreA = scoreComparedResultText(teamAScore, format, model);
      const scoreB = scoreComparedResultText(teamBScore, format, model);
      if (!scoreA && !scoreB) return null;
      const teamALabel = teamNamesById.get(teamAId) ?? teamAId;
      const teamBLabel = teamNamesById.get(teamBId) ?? teamBId;
      const text = !scoreA
        ? `${teamBLabel} ${scoreB}`
        : !scoreB
        ? `${teamALabel} ${scoreA}`
        : `${teamALabel} ${scoreA} - ${teamBLabel} ${scoreB}`;
      return {
        id: unit.resultKey,
        prefix: units.length > 1 ? (unit.part ? unit.label : "Hela rundan") : "",
        text,
      };
    })
    .filter((item): item is { id: string; prefix: string; text: string } => Boolean(item));
}

function itemStructuredMatchLabels(round: OtherCompetitionRound, item: { matchResultLabel?: string; unitMatchResults?: Record<string, { matchResultLabel?: string }> }, units: ReturnType<typeof scoringUnitsForRound>) {
  const labels = units
    .map((unit, index) => {
      const text =
        item.unitMatchResults?.[unit.resultKey]?.matchResultLabel ??
        (index === 0 ? item.matchResultLabel ?? "" : "");
      if (!text) return null;
      return {
        id: unit.resultKey,
        prefix: units.length > 1 ? (unit.part ? unit.label : "Hela rundan") : "",
        text,
      };
    })
    .filter((label): label is { id: string; prefix: string; text: string } => Boolean(label));

  if (labels.length > 0) return labels;
  return item.matchResultLabel ? [{ id: `${round.id}:fallback`, prefix: "", text: item.matchResultLabel }] : [];
}

function combinedItemLabels(
  config: OtherCompetitionConfig,
  round: OtherCompetitionRound,
  item: { competitorIds: string[]; matchResultLabel?: string; unitMatchResults?: Record<string, { matchResultLabel?: string }> },
  units: ReturnType<typeof scoringUnitsForRound>
) {
  const scoreLabels = itemScoreComparedLabels(config, round, item, units);
  const matchLabels = itemStructuredMatchLabels(round, item, units);
  const byId = new Map<string, { id: string; prefix: string; text: string }>();

  for (const label of [...matchLabels, ...scoreLabels]) {
    byId.set(label.id, label);
  }

  return units
    .map((unit) => byId.get(unit.resultKey))
    .filter((label): label is { id: string; prefix: string; text: string } => Boolean(label));
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

function detailedFormatLabel(format: OtherCompetitionRound["format"], model: OtherCompetitionScoringModel, customName?: string) {
  const base = formatLabel(format, customName);
  if (format === "stableford" && model.kind === "placement" && model.placementMetric === "points") return "Individuell poängbogey";
  if (format === "greensome" && model.kind === "match") return `${base} matchspel`;
  if (format === "best_ball") {
    if (model.kind === "match" && resolvedResultDisplay(format, model) === "points") return `${base} slagspel`;
    if (model.kind === "match") return `${base} matchspel`;
  }
  if (model.kind === "placement" && model.placementMetric === "strokes") return `${base} slagspel`;
  if (model.kind === "placement" && model.placementMetric === "points") return `${base} poängbogey`;
  return base;
}

function partFormatLabel(part: NonNullable<OtherCompetitionRound["parts"]>[number], round: OtherCompetitionRound) {
  return detailedFormatLabel(part.format ?? round.format, part.scoringModel, part.customFormatName);
}

function roundFormatSummary(round: OtherCompetitionRound) {
  const parts = (round.parts ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  if (parts.length > 0) return parts.map((part) => partFormatLabel(part, round)).join(" + ");
  return detailedFormatLabel(round.format, round.scoringModel, round.customFormatName);
}

function roundHolesSummary(round: OtherCompetitionRound) {
  const parts = (round.parts ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  if (parts.length >= 2) return `${parts.map((part) => part.holes).join("+")} hål`;
  return `${round.holes} hål`;
}

function usesTeamPoolForMatchRound(round: OtherCompetitionRound, teamCount: number) {
  if (teamCount <= 0) return false;
  if (round.format === "single_match" || round.format === "switch_match_9") return true;
  return (round.parts ?? []).some((part) => (part.format ?? round.format) === "single_match" || (part.format ?? round.format) === "switch_match_9");
}

function segmentLabel(segment: OtherCompetitionSchedulePairing["segment"]) {
  return segment === "front_9" ? "Första 9" : "Bakre 9";
}

function matchPairingSegments(round: OtherCompetitionRound): Array<OtherCompetitionSchedulePairing["segment"]> {
  if (round.format === "switch_match_9") return ["front_9", "back_9"];
  const matchParts = (round.parts ?? []).filter((part) => (part.format ?? round.format) === "single_match" || (part.format ?? round.format) === "switch_match_9");
  return matchParts.length >= 2 ? ["front_9", "back_9"] : ["front_9"];
}

function matchSegmentHeading(round: OtherCompetitionRound, segment: OtherCompetitionSchedulePairing["segment"]) {
  if (matchPairingSegments(round).length < 2) return "Matcher";
  return segment === "front_9" ? "Matcher hål 1-9" : "Matcher hål 10-18";
}

function matchMarginLabel(pairing: Pick<OtherCompetitionSchedulePairing, "matchPoints" | "holesRemaining">) {
  const matchPoints = Number(pairing.matchPoints ?? 0);
  const holesRemaining = Number(pairing.holesRemaining ?? 0);
  if (!Number.isFinite(matchPoints) || matchPoints <= 0) return "";
  if (!Number.isFinite(holesRemaining) || holesRemaining <= 0) return `${matchPoints}up`;
  return `${matchPoints}&${holesRemaining}`;
}

function pairingDisplayLabel(
  pairing: OtherCompetitionSchedulePairing,
  players: Map<string, Competitor>
) {
  const [playerAId, playerBId] = pairing.playerIds;
  const playerAName = playerAId ? firstName(players.get(playerAId)?.name ?? playerAId) : "";
  const playerBName = playerBId ? firstName(players.get(playerBId)?.name ?? playerBId) : "";
  if (pairing.halved) return playerAName && playerBName ? `${playerAName} vs ${playerBName} delad` : "Delad match";
  if (!pairing.winnerId) return playerAName && playerBName ? `${playerAName} vs ${playerBName}` : pairing.resultLabel || "";
  const winnerName = firstName(players.get(pairing.winnerId)?.name ?? pairing.winnerId);
  const loserName =
    pairing.winnerId === playerAId ? playerBName : pairing.winnerId === playerBId ? playerAName : "";
  const margin = matchMarginLabel(pairing);
  if (margin && loserName) return `${winnerName} ${margin} vs ${loserName}`;
  if (loserName) return `${winnerName} vann vs ${loserName}`;
  return margin ? `${winnerName} ${margin}` : `${winnerName} vann`;
}

function scheduleItemLabel(index: number) {
  return `Boll ${index + 1}`;
}

function totalPointsForUnitResult(
  result: OtherCompetitionResult | undefined,
  unit: ReturnType<typeof scoringUnitsForRound>[number]
) {
  if (!result) return 0;
  const raw = Number(result.points || 0) + Number(result.adjustment || 0) + Number(result.bonus || 0);
  const max = scoringModelForUnit(unit).maxPoints;
  if (typeof max === "number" && Number.isFinite(max)) return Math.min(raw, max);
  return raw;
}

function splitUnitLabel(unit: ReturnType<typeof scoringUnitsForRound>[number], index: number, unitCount: number) {
  const label = unit.part?.name ?? unit.label;
  if (/1\s*-\s*9|första 9|front/i.test(label)) return "Hål 1-9:";
  if (/10\s*-\s*18|bakre 9|back/i.test(label)) return "Hål 10-18:";
  if (unitCount === 2) return index === 0 ? "Hål 1-9:" : "Hål 10-18:";
  return `${label}:`;
}

function splitRoundPointsSummary(
  config: OtherCompetitionConfig,
  round: OtherCompetitionRound,
  competitor: Competitor
) {
  const units = scoringUnitsForRound(round);
  if (units.length < 2) return null;

  const parts = units.map((unit, index) => {
    const directResult = (config.results[unit.resultKey] ?? []).find((row) => row.competitorId === competitor.id);
    const fallbackResult =
      competitor.type === "team" && round.playMode === "team"
        ? derivedTeamMatchResultForUnit(config, unit, competitor.id) ?? undefined
        : undefined;
    const total = totalPointsForUnitResult(directResult ?? fallbackResult, unit);
    return `${splitUnitLabel(unit, index, units.length)} ${fmtTablePoints(total)}`;
  });

  return parts.join(" · ");
}

function resultHasContent(result: OtherCompetitionResult | undefined) {
  if (!result) return false;
  if (typeof result.rawScore === "number" && Number.isFinite(result.rawScore)) return true;
  if (result.scoreLabel.trim()) return true;
  if (result.note.trim()) return true;
  if (result.adjustment !== 0 || result.bonus !== 0) return true;
  if (result.winnerOverride || result.placementOverride != null) return true;
  if (result.points !== 0) return true;
  return Object.values(result.playerScores ?? {}).some((value) => typeof value === "number" && Number.isFinite(value));
}

function roundHasDisplayableResults(config: OtherCompetitionConfig, round: OtherCompetitionRound) {
  if (!round.locked) return false;

  return scoringUnitsForRound(round).some((unit) => {
    const directResults = config.results[unit.resultKey] ?? [];
    if (directResults.some(resultHasContent)) return true;

    if (round.playMode === "team") {
      return competitorsForRound(config, round).some(
        (competitor) => competitor.type === "team" && Boolean(derivedTeamMatchResultForUnit(config, unit, competitor.id))
      );
    }

    if (round.playMode === "individual") {
      return competitorsForRound(config, round).some(
        (competitor) => competitor.type === "player" && Boolean(derivedIndividualMatchResultForUnit(config, unit, competitor.id))
      );
    }

    return false;
  });
}

function shouldShowTeamResultsForRound(config: OtherCompetitionConfig, round: OtherCompetitionRound) {
  if (config.teams.length === 0 || round.playMode !== "individual") return false;
  return scoringUnitsForRound(round).some((unit) => {
    const format = unit.part?.format ?? round.format;
    return format === "single_match" || format === "switch_match_9";
  });
}

function teamResultRowsForRound(config: OtherCompetitionConfig, round: OtherCompetitionRound) {
  const units = scoringUnitsForRound(round);
  const teamEntries = config.teams.map((team) => {
    const competitor: Competitor = {
      id: team.id,
      type: "team",
      name: teamDisplayName(team, config.players),
      avatarUrl: config.players.find((player) => player.id === team.memberIds[0])?.avatarUrl ?? null,
      memberNames: team.memberIds
        .map((playerId) => config.players.find((player) => player.id === playerId)?.name)
        .filter((name): name is string => Boolean(name)),
      teamId: team.id,
      teamName: teamDisplayName(team, config.players),
      teamColor: team.color,
      teamIcon: team.icon ?? null,
    };

    const pointsByUnit = Object.fromEntries(
      units.map((unit) => {
        const points = team.memberIds.reduce((sum, playerId) => {
          const result =
            (config.results[unit.resultKey] ?? []).find((row) => row.competitorId === playerId) ??
            derivedIndividualMatchResultForUnit(config, unit, playerId) ??
            undefined;
          return sum + totalPointsForUnitResult(result, unit);
        }, 0);
        return [unit.resultKey, points];
      })
    );

    const total = units.reduce((sum, unit) => sum + (pointsByUnit[unit.resultKey] ?? 0), 0);
    const detail =
      units.length > 1
        ? units
            .map((unit, index) => `${splitUnitLabel(unit, index, units.length)} ${fmtTablePoints(pointsByUnit[unit.resultKey] ?? 0)}`)
            .join(" · ")
        : null;

    return {
      competitor,
      points: total,
      placement: null,
      overridden: false,
      winnerOverride: false,
      result: undefined,
      detail,
    };
  });

  return rankEntries(teamEntries).map((entry) => ({
    ...entry,
    detail: teamEntries.find((teamEntry) => teamEntry.competitor.id === entry.competitor.id)?.detail ?? null,
  }));
}

function teamPlayerScoreSummary(
  config: OtherCompetitionConfig,
  round: OtherCompetitionRound,
  competitor: Competitor,
  result?: OtherCompetitionResult
) {
  if (competitor.type !== "team" || !result?.playerScores) return null;
  const units = scoringUnitsForRound(round);
  if (units.length !== 1) return null;
  const model = scoringModelForUnit(units[0]);
  if (model.kind !== "placement" || (model.placementMetric ?? "points") !== "points") return null;

  const team = config.teams.find((entry) => entry.id === competitor.id);
  if (!team) return null;

  const orderedScores = team.memberIds
    .map((playerId) => result.playerScores?.[playerId])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (orderedScores.length < 2) return null;

  const total =
    typeof result.rawScore === "number" && Number.isFinite(result.rawScore)
      ? result.rawScore
      : orderedScores.reduce((sum, value) => sum + value, 0);

  return `${orderedScores.map((value) => fmtPoints(value)).join(" + ")} = ${fmtPoints(total)}p`;
}

function teamStrokeScoreSummary(
  round: OtherCompetitionRound,
  competitor: Competitor,
  result?: OtherCompetitionResult
) {
  if (competitor.type !== "team" || !result) return null;
  const units = scoringUnitsForRound(round);
  if (units.length !== 1) return null;
  const unit = units[0];
  const model = scoringModelForUnit(unit);
  const format = unit.part?.format ?? round.format;
  if (format !== "scramble") return null;
  if (model.kind !== "placement" || (model.placementMetric ?? "points") !== "strokes") return null;
  if (typeof result.rawScore !== "number" || !Number.isFinite(result.rawScore)) return null;
  return `${fmtPoints(result.rawScore)} slag`;
}

function unitForSegment(round: OtherCompetitionRound, units: ReturnType<typeof scoringUnitsForRound>, segment: OtherCompetitionSchedulePairing["segment"]) {
  if (units.length === 0) return null;
  if (units.length === 1) return units[0];
  return units[segment === "front_9" ? 0 : Math.min(1, units.length - 1)];
}

function teamPointsForItemSegment(
  config: OtherCompetitionConfig,
  round: OtherCompetitionRound,
  item: { competitorIds: string[] },
  unit: ReturnType<typeof scoringUnitsForRound>[number] | null
) {
  if (!unit || item.competitorIds.length < 2) return [];
  const results = config.results[unit.resultKey] ?? [];
  const competitors = new Map(scheduleCompetitorsForRound(config, round).map((competitor) => [competitor.id, competitor]));
  return item.competitorIds.map((competitorId) => {
    const competitor = competitors.get(competitorId);
    const team = config.teams.find((row) => row.id === competitorId);
    const points =
      round.playMode === "team"
        ? results
            .filter((result) => result.competitorId === competitorId)
            .reduce((sum, result) => sum + Number(result.points || 0) + Number(result.adjustment || 0) + Number(result.bonus || 0), 0)
        : (team?.memberIds ?? [])
            .map((playerId) => results.find((result) => result.competitorId === playerId))
            .reduce((sum, result) => sum + Number(result?.points || 0) + Number(result?.adjustment || 0) + Number(result?.bonus || 0), 0);
    return {
      competitorId,
      label: competitor?.name ?? competitorId,
      points,
    };
  });
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
  if (usesTeamPoolForMatchRound(round, config.teams.length)) {
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
  if (!round.locked) return null;
  return scoringUnitsForRound(round).reduce((sum, unit) => sum + (row.roundPoints[unit.resultKey] ?? 0), 0);
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

function TeamBadge({ competitor }: { competitor: Pick<Competitor, "teamName" | "teamColor" | "type"> }) {
  if (!competitor.teamName) return null;
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium text-white/86"
      style={{
        backgroundColor: `${competitor.teamColor ?? "#ffffff"}22`,
        borderColor: `${competitor.teamColor ?? "#ffffff"}66`,
      }}
    >
      <span className="truncate">{competitor.teamName}</span>
    </span>
  );
}

function formatRoundDate(value: string) {
  if (!value) return "Datum saknas";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
}

function podiumHeight(placing: number) {
  if (placing === 1) return "h-40 sm:h-48";
  if (placing === 2) return "h-32 sm:h-40";
  return "h-24 sm:h-32";
}

function podiumTone(placing: number) {
  if (placing === 1) return "from-amber-300/20 via-amber-200/10 to-white/5 border-amber-200/20";
  if (placing === 2) return "from-slate-200/20 via-slate-100/10 to-white/5 border-slate-200/20";
  return "from-orange-400/20 via-orange-200/10 to-white/5 border-orange-200/20";
}

function podiumSymbol(placing: number) {
  if (placing === 1) return <span className="text-5xl leading-none sm:text-6xl">🥇</span>;
  if (placing === 2) return <span className="text-4xl leading-none sm:text-5xl">🥈</span>;
  return <span className="text-4xl leading-none sm:text-5xl">🥉</span>;
}

function PodiumAvatars({
  players,
  fallbackName,
  fallbackAvatar,
  placing,
}: {
  players: OtherCompetitionPlayer[];
  fallbackName: string;
  fallbackAvatar: string | null;
  placing: number;
}) {
  const shownPlayers = players.slice(0, 2);
  const size = placing === 1 ? "h-16 w-16 sm:h-[72px] sm:w-[72px]" : "h-12 w-12 sm:h-14 sm:w-14";
  const fallbackSize = placing === 1 ? "h-16 w-16 sm:h-[72px] sm:w-[72px]" : "h-12 w-12 sm:h-14 sm:w-14";

  if (shownPlayers.length === 0) {
    return (
      <div className={`${fallbackSize} shrink-0 overflow-hidden rounded-full border-2 border-white/10 bg-white/5`}>
        {fallbackAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fallbackAvatar} alt={fallbackName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-white/58">
            {fallbackName.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex justify-center -space-x-3">
      {shownPlayers.map((player) => (
        <div key={player.id} className={`${size} overflow-hidden rounded-full border-2 border-[#070b14] bg-white/5`}>
          {player.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={player.avatarUrl} alt={player.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-white/58">
              {player.name.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FinishedPodium({
  competition,
  standings,
}: {
  competition: OtherCompetitionRow;
  standings: ReturnType<typeof totalStandings>;
}) {
  const topThree = standings.slice(0, 3);

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/5">
      {competition.header_image_url || competition.card_image_url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={competition.header_image_url ?? competition.card_image_url ?? ""}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.14]"
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(126,184,255,0.20),transparent_45%),linear-gradient(180deg,rgba(6,12,22,0.20),rgba(6,12,22,0.94))]" />
        </>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(126,184,255,0.20),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(6,12,22,0.94))]" />
      )}

      <div className="relative p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-white/52">Slutställning</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{competition.name}</h2>
            <div className="mt-2 text-sm text-white/62">
              {formatDateRange(competition.starts_on, competition.ends_on)}
              {competition.location ? ` · ${competition.location}` : ""}
            </div>
          </div>
          <div className="rounded-full border border-emerald-300/25 bg-emerald-400/12 px-4 py-2 text-sm font-medium text-emerald-50">
            Slutförd
          </div>
        </div>

        <div className="mt-7 grid grid-cols-3 items-end gap-2 sm:gap-4 lg:gap-6">
          {[
            { visualPlace: 2, row: topThree[1] ?? null },
            { visualPlace: 1, row: topThree[0] ?? null },
            { visualPlace: 3, row: topThree[2] ?? null },
          ].map(({ visualPlace, row }) => {
            if (!row) {
              return (
                <div
                  key={`empty-${visualPlace}`}
                  className="min-h-[210px] rounded-[24px] border border-dashed border-white/10 bg-black/10"
                />
              );
            }

            const players = playersForCompetitor(competition.config, row.competitor);
            const displayPlace = Math.min(Math.max(row.placement ?? visualPlace, 1), 3);

            return (
              <div key={`${row.competitor.id}-${visualPlace}`} className="min-w-0">
                <div className="flex h-[340px] flex-col justify-end px-1 text-center sm:h-[390px] sm:px-3">
                  <div className="mb-4 flex min-h-[118px] flex-col items-center justify-end">
                    <div
                      className={
                        displayPlace === 1
                          ? "rounded-full bg-[radial-gradient(circle,rgba(250,214,110,0.30)_0%,rgba(250,214,110,0.08)_55%,transparent_75%)] p-[6px] shadow-[0_0_40px_rgba(245,204,96,0.35)]"
                          : ""
                      }
                    >
                      <PodiumAvatars
                        players={players}
                        fallbackName={row.competitor.name}
                        fallbackAvatar={row.competitor.avatarUrl}
                        placing={displayPlace}
                      />
                    </div>

                    <div className="mt-3 min-w-0">
                      <div className="text-xs font-semibold leading-tight text-white break-words sm:text-sm">
                        {row.competitor.name}
                      </div>
                      <div className="mt-1 text-[10px] leading-tight text-white/60 sm:text-[11px]">
                        Plats {row.placement ?? visualPlace} · {fmtTablePoints(row.total)}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`flex w-full items-start justify-center rounded-t-[24px] border border-b-0 bg-gradient-to-b px-2 pt-5 ${podiumHeight(displayPlace)} ${podiumTone(displayPlace)}`}
                  >
                    <div className={displayPlace === 1 ? "" : "pt-2"}>
                      {podiumSymbol(displayPlace)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {topThree.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-white/58">
            Inga resultat att visa ännu.
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function OtherCompetitionPublicClient({
  initialCompetition,
}: {
  initialCompetition: OtherCompetitionRow;
}) {
  const [competition, setCompetition] = useState(initialCompetition);
  const [tab, setTab] = useState<Tab>(initialCompetition.status === "locked" ? "podium" : "standings");
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
  const rulesContent = useMemo(
    () => (competition.rules_content?.trim() ? competition.rules_content : buildCompetitionRulesDraft(competition.config)),
    [competition.config, competition.rules_content]
  );
  const nextCountdown = competition.status !== "locked" ? daysUntil(competition.starts_on) : null;
  const showCountdown = nextCountdown != null && nextCountdown > 0;
  const rounds = competition.config.rounds.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const groupedRounds = dayGroups(rounds);
  const tabs: Tab[] = competition.status === "locked" ? ["podium", ...BASE_TABS] : [...BASE_TABS];
  const activeTab = tabs.some((item) => item === tab) ? tab : tabs[0];

  return (
    <main className="space-y-5">
      <section className="relative -mx-4 -mt-24 overflow-hidden bg-black/35 md:mx-0 md:-mt-28 md:rounded-[28px] md:border md:border-white/10">
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
              <span className="rounded-full border border-orange-200/80 bg-orange-500/80 px-3 py-1 text-xs font-semibold text-white shadow-[0_10px_30px_rgba(249,115,22,0.35)] backdrop-blur-sm">
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
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={[
              "h-10 shrink-0 rounded-xl border px-4 text-sm font-medium transition",
              activeTab === item
                ? "border-white/25 bg-white/12 text-white"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
            ].join(" ")}
          >
            {tabLabel(item)}
          </button>
        ))}
      </nav>

      {activeTab === "podium" && competition.status === "locked" ? (
        <FinishedPodium competition={competition} standings={standings} />
      ) : null}

      {activeTab === "standings" ? (
        <section className="overflow-x-auto">
          <div className="space-y-2" style={{ minWidth: Math.max(540, 314 + rounds.length * 50) }}>
            <div
              className="grid grid-cols-[34px_minmax(190px,1fr)_repeat(var(--rounds),50px)_66px] items-center rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-white/42"
              style={{ "--rounds": rounds.length } as CSSProperties}
            >
              <div>#</div>
              <div>Lag</div>
              {rounds.map((round) => (
                <div key={round.id} className="text-right">
                  R{round.sortOrder + 1}
                </div>
              ))}
              <div className="text-right">Totalt</div>
            </div>
            <div className="grid gap-2">
              {standings.map((row) => (
                <div
                  key={row.competitor.id}
                  className="grid grid-cols-[34px_minmax(190px,1fr)_repeat(var(--rounds),50px)_66px] items-center rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2"
                  style={{ "--rounds": rounds.length } as CSSProperties}
                >
                  <div className="text-sm font-semibold tabular-nums text-white/86">{row.placement ?? "-"}</div>
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex shrink-0 -space-x-2">
                      {playersForCompetitor(competition.config, row.competitor).slice(0, 2).map((player) => (
                        <MiniAvatar
                          key={player.id}
                          src={player.avatarUrl}
                          name={player.name}
                          glowColor={row.competitor.teamColor}
                        />
                      ))}
                      {playersForCompetitor(competition.config, row.competitor).length === 0 ? (
                        <Avatar
                          src={row.competitor.avatarUrl}
                          name={row.competitor.name}
                          glowColor={row.competitor.teamColor}
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 truncate text-sm font-semibold">{row.competitor.name}</div>
                  </div>
                  {rounds.map((round) => (
                    <div key={round.id} className="text-right text-sm font-semibold tabular-nums text-white/82">
                      {(() => {
                        const roundPoints = roundPointsFor(row, round);
                        return roundPoints == null ? "-" : fmtTablePoints(roundPoints);
                      })()}
                    </div>
                  ))}
                  <div className="text-right text-base font-semibold tabular-nums text-white">
                    {fmtTablePoints(row.total)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "schedule" ? (
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
                  const resultRows = shouldShowTeamResultsForRound(competition.config, round)
                    ? teamResultRowsForRound(competition.config, round)
                    : rows;
                  const competitors = new Map(scheduleCompetitorsForRound(competition.config, round).map((item) => [item.id, item]));

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
                              {roundFormatSummary(round)} · {roundHolesSummary(round)}
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

                          <div className="mt-4 grid gap-2">
                            {round.schedule.map((item, itemIndex) => (
                              <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="font-semibold">
                                      {scheduleItemLabel(itemIndex)}
                                    </div>
                                    <div className="mt-2 overflow-x-auto pb-1">
                                      <div className="flex min-w-max items-center gap-2">
                                        {item.competitorIds.map((id) => {
                                          const competitor = competitors.get(id);
                                          return competitor ? (
                                            <span key={id} className="rounded-2xl border border-white/10 bg-white/5 px-2.5 py-1 text-sm whitespace-nowrap text-white/78">
                                              {competitor.name}
                                              {competitor.type === "player" && competitor.teamName ? (
                                                <span className="ml-2 inline-flex align-middle">
                                                  <TeamBadge competitor={competitor} />
                                                </span>
                                              ) : null}
                                            </span>
                                          ) : (
                                            <span key={id} className="rounded-2xl border border-white/10 bg-white/5 px-2.5 py-1 text-sm whitespace-nowrap text-white/58">
                                              {id}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="shrink-0 text-sm font-semibold tabular-nums text-white/82">
                                    {item.time || "--"}
                                  </div>
                                </div>
                                {item.note ? <div className="mt-2 text-sm text-white/55">{item.note}</div> : null}
                              </div>
                            ))}
                            {round.schedule.length === 0 ? (
                              <div className="rounded-2xl border border-dashed border-white/10 px-3 py-5 text-center text-white/52">
                                Inget schema publicerat för rundan.
                              </div>
                            ) : null}
                          </div>

                          {roundHasDisplayableResults(competition.config, round) && resultRows.length > 0 ? (
                            <div className="mt-4 border-t border-white/10 pt-4">
                              <div className="mb-2 text-xs uppercase tracking-[0.18em] text-white/42">Resultat</div>
                              <div className="grid gap-2">
                                {resultRows.slice(0, 6).map((row) => {
                                  const splitPointsSummary = splitRoundPointsSummary(competition.config, round, row.competitor);
                                  const playerScoreSummary = teamPlayerScoreSummary(competition.config, round, row.competitor, row.result);
                                  const strokeScoreSummary = teamStrokeScoreSummary(round, row.competitor, row.result);
                                  const inlineSplitSummary = "detail" in row && typeof row.detail === "string" ? row.detail : null;
                                  return (
                                    <div key={row.competitor.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                                      <div className="min-w-0">
                                        <span className="font-medium">{row.competitor.name}</span>
                                        {row.competitor.type === "player" && row.competitor.teamName ? (
                                          <span className="ml-2 inline-flex align-middle">
                                            <TeamBadge competitor={row.competitor} />
                                          </span>
                                        ) : null}
                                        {strokeScoreSummary ? (
                                          <span className="ml-2 text-sm text-white/55">{strokeScoreSummary}</span>
                                        ) : null}
                                        {inlineSplitSummary ? (
                                          <div className="mt-1 truncate text-xs text-white/45">{inlineSplitSummary}</div>
                                        ) : splitPointsSummary ? (
                                          <div className="mt-1 truncate text-xs text-white/45">{splitPointsSummary}</div>
                                        ) : playerScoreSummary ? (
                                          <div className="mt-1 truncate text-xs text-white/45">{playerScoreSummary}</div>
                                        ) : null}
                                      </div>
                                      <div className="font-semibold tabular-nums">{fmtTablePoints(row.points)}</div>
                                    </div>
                                  );
                                })}
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

      {activeTab === "players" ? (
        <section className="grid gap-4 md:grid-cols-2">
          {competition.config.teams.length > 0
            ? competition.config.teams.map((team) => {
                const members = team.memberIds
                  .map((id) => competition.config.players.find((player) => player.id === id))
                  .filter(Boolean) as OtherCompetitionPlayer[];
                const targetSize = Math.max(1, Number(team.targetSize ?? 0) || members.length || 1);
                return (
                  <div
                    key={team.id}
                    className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4"
                    style={{ boxShadow: `inset 4px 0 0 ${team.color}` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex shrink-0 -space-x-3">
                        {members.slice(0, 3).map((member) => (
                          <div key={member.id} className="rounded-full ring-2 ring-[#070b14]">
                            <Avatar src={member.avatarUrl} name={member.name} />
                          </div>
                        ))}
                        {members.length === 0 ? (
                          <div
                            className="h-9 w-9 rounded-full border"
                            style={{ backgroundColor: `${team.color}33`, borderColor: `${team.color}88` }}
                            aria-hidden
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <div className="mb-1 flex min-w-0 items-center gap-2">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full border"
                            style={{ backgroundColor: team.color, borderColor: `${team.color}88` }}
                            aria-hidden
                          />
                          <h2 className="truncate text-xl font-semibold">
                            {team.name || teamDisplayName(team, competition.config.players) || "Lag"}
                          </h2>
                        </div>
                        <div className="text-xs text-white/50">{members.length}/{targetSize} platser</div>
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

      {activeTab === "rules" ? (
        <section className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5">
          <div className="prose prose-invert max-w-none whitespace-pre-wrap text-sm leading-7 text-white/76">
            {rulesContent}
          </div>
        </section>
      ) : null}
    </main>
  );
}
