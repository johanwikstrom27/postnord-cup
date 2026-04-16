import type {
  OtherCompetitionConfig,
  OtherCompetitionPlayer,
  OtherCompetitionResult,
  OtherCompetitionRound,
  OtherCompetitionRoundPart,
  OtherCompetitionTeam,
} from "@/lib/otherCompetitions/types";

export type Competitor = {
  id: string;
  type: "player" | "team";
  name: string;
  avatarUrl: string | null;
  memberNames: string[];
  teamId?: string | null;
  teamName?: string | null;
  teamColor?: string | null;
  teamIcon?: string | null;
};

export type RankedEntry = {
  competitor: Competitor;
  points: number;
  placement: number | null;
  overridden: boolean;
  winnerOverride: boolean;
  result?: OtherCompetitionResult;
};

export type StandingEntry = {
  competitor: Competitor;
  roundPoints: Record<string, number>;
  total: number;
  placement: number | null;
  overridden: boolean;
};

export type ScoringUnit = {
  id: string;
  resultKey: string;
  label: string;
  holes: number;
  round: OtherCompetitionRound;
  part: OtherCompetitionRoundPart | null;
};

function bySortOrder<T extends { sortOrder: number }>(rows: T[]) {
  return rows.slice().sort((a, b) => a.sortOrder - b.sortOrder);
}

export function teamByPlayerId(config: OtherCompetitionConfig, playerId: string) {
  return config.teams.find((team) => team.memberIds.includes(playerId)) ?? null;
}

export function teamDisplayName(team: OtherCompetitionTeam, players: OtherCompetitionPlayer[]) {
  const explicit = team.name.trim();
  if (explicit) return explicit;

  const byId = new Map(players.map((player) => [player.id, player.name]));
  const names = team.memberIds
    .map((id) => byId.get(id)?.trim().split(/\s+/)[0])
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) return `Lag ${team.sortOrder + 1}`;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

export function competitorsForRound(config: OtherCompetitionConfig, round: OtherCompetitionRound): Competitor[] {
  if (round.playMode === "team") {
    return bySortOrder(config.teams).map((team) => {
      const members = team.memberIds
        .map((id) => config.players.find((player) => player.id === id))
        .filter((player): player is OtherCompetitionPlayer => Boolean(player));

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
    });
  }

  return bySortOrder(config.players).map((player) => {
    const team = teamByPlayerId(config, player.id);
    return {
      id: player.id,
      type: "player" as const,
      name: player.name,
      avatarUrl: player.avatarUrl,
      memberNames: [player.name],
      teamId: team?.id ?? null,
      teamName: team ? teamDisplayName(team, config.players) : null,
      teamColor: team?.color ?? null,
      teamIcon: team?.icon ?? null,
    };
  });
}

export function allCompetitors(config: OtherCompetitionConfig): Competitor[] {
  const hasTeams = config.teams.length > 0;
  if (hasTeams && config.settings.isTeamCompetition !== false) {
    return bySortOrder(config.teams).map((team) => {
      const members = team.memberIds
        .map((id) => config.players.find((player) => player.id === id))
        .filter((player): player is OtherCompetitionPlayer => Boolean(player));

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
    });
  }

  return bySortOrder(config.players).map((player) => {
    const team = teamByPlayerId(config, player.id);
    return {
      id: player.id,
      type: "player" as const,
      name: player.name,
      avatarUrl: player.avatarUrl,
      memberNames: [player.name],
      teamId: team?.id ?? null,
      teamName: team ? teamDisplayName(team, config.players) : null,
      teamColor: team?.color ?? null,
      teamIcon: team?.icon ?? null,
    };
  });
}

export function resultTotal(result: OtherCompetitionResult | undefined, round?: OtherCompetitionRound) {
  if (!result) return 0;
  const raw = Number(result.points || 0) + Number(result.adjustment || 0) + Number(result.bonus || 0);
  const max = round?.scoringModel.maxPoints;
  if (typeof max === "number" && Number.isFinite(max)) return Math.min(raw, max);
  return raw;
}

export function scoringUnitsForRound(round: OtherCompetitionRound): ScoringUnit[] {
  const parts = (round.parts ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  if (parts.length === 0) {
    return [
      {
        id: round.id,
        resultKey: round.id,
        label: round.name,
        holes: round.holes,
        round,
        part: null,
      },
    ];
  }

  return parts.map((part) => ({
    id: part.id,
    resultKey: `${round.id}:${part.id}`,
    label: part.name,
    holes: part.holes,
    round,
    part,
  }));
}

export function scoringModelForUnit(unit: ScoringUnit) {
  return unit.part?.scoringModel ?? unit.round.scoringModel;
}

function placementHigherIsBetter(unit: ScoringUnit) {
  return (scoringModelForUnit(unit).placementMetric ?? "points") !== "strokes";
}

export function allScoringUnits(config: OtherCompetitionConfig) {
  return config.rounds.flatMap(scoringUnitsForRound);
}

function resultTotalForUnit(result: OtherCompetitionResult | undefined, unit: ScoringUnit) {
  if (!result) return 0;
  const raw = Number(result.points || 0) + Number(result.adjustment || 0) + Number(result.bonus || 0);
  const max = scoringModelForUnit(unit).maxPoints;
  if (typeof max === "number" && Number.isFinite(max)) return Math.min(raw, max);
  return raw;
}

export function rankEntries(
  entries: Array<{
    competitor: Competitor;
    points: number;
    result?: OtherCompetitionResult;
  }>
): RankedEntry[] {
  const sorted = entries.slice().sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (a.result?.winnerOverride && !b.result?.winnerOverride) return -1;
    if (!a.result?.winnerOverride && b.result?.winnerOverride) return 1;
    return a.competitor.name.localeCompare(b.competitor.name, "sv");
  });

  let currentPlace = 1;
  let lastPoints: number | null = null;
  let lastWinnerOverride: boolean | null = null;
  let lastPlace = 1;

  return sorted.map((entry, index) => {
    const winnerOverride = Boolean(entry.result?.winnerOverride);
    let placement: number;

    if (lastPoints === null) {
      placement = 1;
    } else if (entry.points === lastPoints && winnerOverride === lastWinnerOverride) {
      placement = lastPlace;
    } else {
      currentPlace = index + 1;
      placement = currentPlace;
    }

    lastPoints = entry.points;
    lastWinnerOverride = winnerOverride;
    lastPlace = placement;

    return {
      competitor: entry.competitor,
      points: entry.points,
      placement,
      overridden: false,
      winnerOverride,
      result: entry.result,
    };
  });
}

export function roundLeaderboard(config: OtherCompetitionConfig, round: OtherCompetitionRound): RankedEntry[] {
  const competitors = competitorsForRound(config, round);
  const units = scoringUnitsForRound(round);
  const resultsByUnit = units.map((unit) => ({
    unit,
    results: new Map((config.results[unit.resultKey] ?? []).map((result) => [result.competitorId, result])),
  }));

  return rankEntries(
    competitors.map((competitor) => {
      const points = resultsByUnit.reduce((sum, row) => {
        const result = row.results.get(competitor.id);
        return sum + resultTotalForUnit(result, row.unit);
      }, 0);
      const result = resultsByUnit.map((row) => row.results.get(competitor.id)).find(Boolean);
      return {
        competitor,
        points,
        result,
      };
    })
  );
}

export function totalStandings(config: OtherCompetitionConfig): StandingEntry[] {
  const competitors = allCompetitors(config);
  const entries = competitors.map((competitor) => {
    const roundPoints: Record<string, number> = {};
    let total = 0;

    for (const unit of allScoringUnits(config)) {
      const round = unit.round;
      if (!round.locked) {
        roundPoints[unit.resultKey] = 0;
        continue;
      }
      const results = config.results[unit.resultKey] ?? [];
      let points = 0;

      if (competitor.type === "team") {
        if (round.playMode === "team") {
          points = resultTotalForUnit(results.find((row) => row.competitorId === competitor.id), unit);
        } else {
          const team = config.teams.find((row) => row.id === competitor.id);
          points = (team?.memberIds ?? []).reduce((sum, playerId) => {
            const result = results.find((row) => row.competitorId === playerId);
            return sum + resultTotalForUnit(result, unit);
          }, 0);
        }
      } else if (round.playMode === "team") {
        const team = teamByPlayerId(config, competitor.id);
        points = resultTotalForUnit(results.find((row) => row.competitorId === team?.id), unit);
      } else {
        points = resultTotalForUnit(results.find((row) => row.competitorId === competitor.id), unit);
      }

      roundPoints[unit.resultKey] = points;
      total += points;
    }

    return {
      competitor,
      points: total,
      roundPoints,
    };
  });

  return rankEntries(entries).map((entry) => ({
    competitor: entry.competitor,
    roundPoints: entries.find((row) => row.competitor.id === entry.competitor.id)?.roundPoints ?? {},
    total: entry.points,
    placement: entry.placement,
    overridden: entry.overridden,
  }));
}

export function applyPlacementScoring(
  round: OtherCompetitionRound,
  results: OtherCompetitionResult[]
): OtherCompetitionResult[] {
  const distribution = round.scoringModel.placementPoints;
  const higherIsBetter = (round.scoringModel.placementMetric ?? "points") !== "strokes";
  const ranked = rankEntries(
    results.map((result) => ({
      competitor: {
        id: result.competitorId,
        type: "player",
        name: result.competitorId,
        avatarUrl: null,
        memberNames: [],
        teamId: null,
        teamName: null,
        teamColor: null,
        teamIcon: null,
      },
      points: higherIsBetter ? Number(result.rawScore ?? result.points ?? 0) : -Number(result.rawScore ?? result.points ?? 0),
      result,
    }))
  );

  const pointsByCompetitor = new Map<string, number>();
  for (const row of ranked) {
    const place = row.placement ?? 0;
    const points = place > 0 ? distribution[place - 1] ?? 0 : 0;
    pointsByCompetitor.set(row.competitor.id, points);
  }

  return results.map((result) => ({
    ...result,
    points: pointsByCompetitor.get(result.competitorId) ?? result.points,
  }));
}
