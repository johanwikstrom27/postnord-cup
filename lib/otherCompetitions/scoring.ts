import type {
  OtherCompetitionConfig,
  OtherCompetitionPlayer,
  OtherCompetitionResult,
  OtherCompetitionRound,
  OtherCompetitionTeam,
} from "@/lib/otherCompetitions/types";

export type Competitor = {
  id: string;
  type: "player" | "team";
  name: string;
  avatarUrl: string | null;
  memberNames: string[];
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

function bySortOrder<T extends { sortOrder: number }>(rows: T[]) {
  return rows.slice().sort((a, b) => a.sortOrder - b.sortOrder);
}

export function teamDisplayName(team: OtherCompetitionTeam, players: OtherCompetitionPlayer[]) {
  const explicit = team.name.trim();
  if (explicit) return explicit;

  const byId = new Map(players.map((player) => [player.id, player.name]));
  const names = team.memberIds.map((id) => byId.get(id)).filter((name): name is string => Boolean(name));
  if (names.length === 0) return "Lag utan spelare";
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
      };
    });
  }

  return bySortOrder(config.players).map((player) => ({
    id: player.id,
    type: "player",
    name: player.name,
    avatarUrl: player.avatarUrl,
    memberNames: [player.name],
  }));
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
      };
    });
  }

  return bySortOrder(config.players).map((player) => ({
    id: player.id,
    type: "player",
    name: player.name,
    avatarUrl: player.avatarUrl,
    memberNames: [player.name],
  }));
}

export function resultTotal(result: OtherCompetitionResult | undefined, round?: OtherCompetitionRound) {
  if (!result) return 0;
  const raw = Number(result.points || 0) + Number(result.adjustment || 0) + Number(result.bonus || 0);
  const max = round?.scoringModel.maxPoints;
  if (typeof max === "number" && Number.isFinite(max)) return Math.min(raw, max);
  return raw;
}

export function rankEntries(
  entries: Array<{
    competitor: Competitor;
    points: number;
    result?: OtherCompetitionResult;
    placementOverride?: number | null;
  }>
): RankedEntry[] {
  const sorted = entries.slice().sort((a, b) => {
    const ao = a.placementOverride ?? a.result?.placementOverride ?? null;
    const bo = b.placementOverride ?? b.result?.placementOverride ?? null;
    if (ao != null && bo != null && ao !== bo) return ao - bo;
    if (ao != null && bo == null) return -1;
    if (ao == null && bo != null) return 1;
    if (b.points !== a.points) return b.points - a.points;
    if (a.result?.winnerOverride && !b.result?.winnerOverride) return -1;
    if (!a.result?.winnerOverride && b.result?.winnerOverride) return 1;
    return a.competitor.name.localeCompare(b.competitor.name, "sv");
  });

  let currentPlace = 1;
  let lastPoints: number | null = null;
  let lastPlace = 1;

  return sorted.map((entry, index) => {
    const override = entry.placementOverride ?? entry.result?.placementOverride ?? null;
    let placement: number;

    if (override != null && Number.isFinite(override) && override > 0) {
      placement = Math.trunc(override);
    } else {
      if (lastPoints === null) {
        placement = 1;
      } else if (entry.points === lastPoints) {
        placement = lastPlace;
      } else {
        currentPlace = index + 1;
        placement = currentPlace;
      }
    }

    if (override == null) {
      lastPoints = entry.points;
      lastPlace = placement;
    }

    return {
      competitor: entry.competitor,
      points: entry.points,
      placement,
      overridden: override != null,
      winnerOverride: Boolean(entry.result?.winnerOverride),
      result: entry.result,
    };
  });
}

export function roundLeaderboard(config: OtherCompetitionConfig, round: OtherCompetitionRound): RankedEntry[] {
  const competitors = competitorsForRound(config, round);
  const results = new Map((config.results[round.id] ?? []).map((result) => [result.competitorId, result]));

  return rankEntries(
    competitors.map((competitor) => {
      const result = results.get(competitor.id);
      return {
        competitor,
        points: resultTotal(result, round),
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

    for (const round of config.rounds) {
      const result = (config.results[round.id] ?? []).find((row) => row.competitorId === competitor.id);
      const points = resultTotal(result, round);
      roundPoints[round.id] = points;
      total += points;
    }

    return {
      competitor,
      points: total,
      roundPoints,
      placementOverride: config.finalPlacementOverrides[competitor.id] ?? null,
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
  const ranked = rankEntries(
    results.map((result) => ({
      competitor: {
        id: result.competitorId,
        type: "player",
        name: result.competitorId,
        avatarUrl: null,
        memberNames: [],
      },
      points: Number(result.rawScore ?? result.points ?? 0),
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
