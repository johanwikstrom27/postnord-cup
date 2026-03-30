export type HcpRules = {
  hcp_zero_max: number | null;
  hcp_two_max: number | null;
  hcp_four_min: number | null;
};

export type PreviewPlayer = {
  season_player_id: string;
  name: string;
  hcp: number;
};

export type PreviewEntry = {
  season_player_id: string;
  gross_strokes: number | null;
  did_not_play: boolean;
  override_placing: number | null;
  lag_nr: number | null;
  lag_score: number | null;
};

export type IndividualPreviewRow = {
  season_player_id: string;
  name: string;
  hcp: number;
  hcpStrokes: number;
  grossStrokes: number | null;
  startScore: number | null;
  netStrokes: number | null;
  adjustedScore: number | null;
  overridePlacing: number | null;
  placing: number | null;
  didNotPlay: boolean;
  incomplete: boolean;
};

export type TeamPreviewRow = {
  lagNr: number;
  score: number | null;
  overridePlacing: number | null;
  placing: number | null;
  memberNames: string[];
  playerCount: number;
  complete: boolean;
};

export type TeamPreviewPlayer = {
  name: string;
  lagNr: number | null;
  didNotPlay: boolean;
};

function validOverride(value: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value > 0 ? Math.trunc(value) : null;
}

function hcpToStrokes(hcp: number, rules: HcpRules): number {
  const zeroMax = Number(rules.hcp_zero_max ?? 10.5);
  const twoMax = Number(rules.hcp_two_max ?? 15.5);
  const fourMin = Number(rules.hcp_four_min ?? 15.6);

  if (hcp <= zeroMax) return 0;
  if (hcp < fourMin && hcp <= twoMax) return 2;
  return 4;
}

function assignPlacingsByScore<T extends { overridePlacing: number | null; placing: number | null }>(
  sorted: T[],
  scoreOf: (row: T) => number
) {
  let groupStart = 1;
  let i = 0;

  while (i < sorted.length) {
    const score = scoreOf(sorted[i]);
    const group: T[] = [];
    let j = i;

    while (j < sorted.length && scoreOf(sorted[j]) === score) {
      group.push(sorted[j]);
      j += 1;
    }

    let maxOverride = 0;
    for (const row of group) {
      const override = validOverride(row.overridePlacing);
      if (override && override > maxOverride) maxOverride = override;
    }

    for (const row of group) {
      const override = validOverride(row.overridePlacing);
      const withinGroup = override ?? Math.max(1, maxOverride + 1);
      row.placing = groupStart + withinGroup - 1;
    }

    groupStart += group.length;
    i = j;
  }
}

export function buildStrokePreview(
  players: PreviewPlayer[],
  entries: PreviewEntry[],
  rules: HcpRules,
  mode: "regular" | "final",
  startScoreMap?: Map<string, number>
) {
  const byEntry = new Map(entries.map((entry) => [entry.season_player_id, entry]));

  const rows: IndividualPreviewRow[] = players.map((player) => {
    const entry = byEntry.get(player.season_player_id);
    const didNotPlay = Boolean(entry?.did_not_play);
    const grossStrokes = entry?.gross_strokes ?? null;
    const hcpStrokes = didNotPlay ? 0 : hcpToStrokes(player.hcp, rules);
    const startScore = mode === "final" ? Number(startScoreMap?.get(player.season_player_id) ?? 0) : null;
    const netStrokes =
      mode === "regular" && grossStrokes != null ? Math.max(0, grossStrokes - hcpStrokes) : null;
    const adjustedScore =
      mode === "final" && grossStrokes != null ? grossStrokes - hcpStrokes + Number(startScore ?? 0) : null;

    return {
      season_player_id: player.season_player_id,
      name: player.name,
      hcp: player.hcp,
      hcpStrokes,
      grossStrokes,
      startScore,
      netStrokes,
      adjustedScore,
      overridePlacing: validOverride(entry?.override_placing ?? null),
      placing: null,
      didNotPlay,
      incomplete: !didNotPlay && grossStrokes == null,
    };
  });

  const playable = rows
    .filter((row) => !row.didNotPlay && !row.incomplete)
    .sort((a, b) => {
      const left = mode === "final" ? Number(a.adjustedScore) : Number(a.netStrokes);
      const right = mode === "final" ? Number(b.adjustedScore) : Number(b.netStrokes);
      return left - right || (a.overridePlacing ?? 999) - (b.overridePlacing ?? 999);
    });

  assignPlacingsByScore(playable, (row) => (mode === "final" ? Number(row.adjustedScore) : Number(row.netStrokes)));

  const incomplete = rows.filter((row) => row.incomplete);
  const dns = rows.filter((row) => row.didNotPlay);

  return {
    playable,
    incomplete,
    dns,
    rows: [...playable, ...incomplete, ...dns],
  };
}

export function buildTeamPreview(players: PreviewPlayer[], entries: PreviewEntry[]) {
  const byEntry = new Map(entries.map((entry) => [entry.season_player_id, entry]));
  const byTeam = new Map<number, TeamPreviewRow>();
  const unassigned: TeamPreviewPlayer[] = [];
  const dns: TeamPreviewPlayer[] = [];

  for (const player of players) {
    const entry = byEntry.get(player.season_player_id);
    const didNotPlay = Boolean(entry?.did_not_play);
    const lagNr = entry?.lag_nr ?? null;

    if (didNotPlay) {
      dns.push({ name: player.name, lagNr, didNotPlay: true });
      continue;
    }

    if (!lagNr) {
      unassigned.push({ name: player.name, lagNr: null, didNotPlay: false });
      continue;
    }

    if (!byTeam.has(lagNr)) {
      byTeam.set(lagNr, {
        lagNr,
        score: entry?.lag_score ?? null,
        overridePlacing: validOverride(entry?.override_placing ?? null),
        placing: null,
        memberNames: [],
        playerCount: 0,
        complete: entry?.lag_score != null,
      });
    }

    const team = byTeam.get(lagNr)!;
    team.memberNames.push(player.name);
    team.playerCount += 1;

    if (entry?.lag_score == null) {
      team.complete = false;
    } else if (team.score == null) {
      team.score = entry.lag_score;
    } else if (team.score !== entry.lag_score) {
      team.complete = false;
    }

    const override = validOverride(entry?.override_placing ?? null);
    if (override != null) {
      team.overridePlacing = team.overridePlacing == null ? override : Math.min(team.overridePlacing, override);
    }
  }

  const teams = Array.from(byTeam.values());
  const rankedTeams = teams
    .filter((team) => team.complete && team.score != null)
    .sort((a, b) => Number(a.score) - Number(b.score) || (a.overridePlacing ?? 999) - (b.overridePlacing ?? 999));

  assignPlacingsByScore(rankedTeams, (row) => Number(row.score));

  const pendingTeams = teams
    .filter((team) => team.placing == null)
    .sort((a, b) => a.lagNr - b.lagNr);

  return {
    rankedTeams,
    pendingTeams,
    unassigned,
    dns,
    teams: [...rankedTeams, ...pendingTeams],
  };
}
