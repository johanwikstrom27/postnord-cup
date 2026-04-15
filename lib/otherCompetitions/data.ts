import type {
  OtherCompetitionConfig,
  OtherCompetitionFormat,
  OtherCompetitionRow,
  OtherCompetitionRound,
  OtherCompetitionRoundPart,
  OtherCompetitionScoringModel,
  OtherCompetitionStatus,
} from "@/lib/otherCompetitions/types";

export const EMPTY_OTHER_COMPETITION_CONFIG: OtherCompetitionConfig = {
  version: 1,
  players: [],
  teams: [],
  rounds: [],
  results: {},
  finalPlacementOverrides: {},
  settings: {
    teamSize: 2,
    plannedPlayerCount: 12,
    plannedTeamCount: 6,
    isTeamCompetition: true,
  },
};

function isStatus(value: unknown): value is OtherCompetitionStatus {
  return value === "draft" || value === "published" || value === "live" || value === "locked";
}

const FORMAT_VALUES: OtherCompetitionFormat[] = [
  "stableford",
  "greensome",
  "best_ball",
  "scramble",
  "single_match",
  "switch_match_9",
  "team_match",
  "stroke_play",
  "foursome",
  "shamble",
  "texas_scramble",
  "eclectic",
  "custom",
];

function isFormat(value: unknown): value is OtherCompetitionFormat {
  return FORMAT_VALUES.includes(value as OtherCompetitionFormat);
}

function isScoringKind(value: unknown): value is OtherCompetitionScoringModel["kind"] {
  return value === "placement" || value === "match" || value === "manual" || value === "custom";
}

function normalizeScoringModel(value: unknown): OtherCompetitionScoringModel {
  const input = typeof value === "object" && value !== null ? (value as Partial<OtherCompetitionScoringModel>) : {};
  return {
    kind: isScoringKind(input.kind) ? input.kind : "placement",
    placementPoints: Array.isArray(input.placementPoints) ? input.placementPoints.filter((item) => Number.isFinite(item)) : [6, 5, 4, 3, 2, 1],
    winPoints: Number.isFinite(input.winPoints) ? Number(input.winPoints) : 2,
    drawPoints: Number.isFinite(input.drawPoints) ? Number(input.drawPoints) : 1,
    lossPoints: Number.isFinite(input.lossPoints) ? Number(input.lossPoints) : 0,
    maxPoints: typeof input.maxPoints === "number" && Number.isFinite(input.maxPoints) ? input.maxPoints : null,
    bonusPoints: Number.isFinite(input.bonusPoints) ? Number(input.bonusPoints) : 0,
    customText: typeof input.customText === "string" ? input.customText : "",
  };
}

function normalizeRoundPart(value: unknown, round: OtherCompetitionRound, index: number): OtherCompetitionRoundPart {
  const input = typeof value === "object" && value !== null ? (value as Partial<OtherCompetitionRoundPart>) : {};
  return {
    id: typeof input.id === "string" && input.id ? input.id : `part-${round.id}-${index}`,
    name: typeof input.name === "string" && input.name ? input.name : `Del ${index + 1}`,
    format: isFormat(input.format) ? input.format : round.format,
    customFormatName: typeof input.customFormatName === "string" ? input.customFormatName : "",
    holes: Number.isFinite(input.holes) ? Number(input.holes) : 9,
    scoringModel: normalizeScoringModel(input.scoringModel ?? round.scoringModel),
    sortOrder: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : index,
  };
}

function normalizeRound(value: unknown, index: number): OtherCompetitionRound {
  const input = typeof value === "object" && value !== null ? (value as Partial<OtherCompetitionRound>) : {};
  const format = isFormat(input.format) ? input.format : "stableford";
  const round: OtherCompetitionRound = {
    id: typeof input.id === "string" && input.id ? input.id : `round-${index}`,
    name: typeof input.name === "string" && input.name ? input.name : `Runda ${index + 1}`,
    date: typeof input.date === "string" ? input.date : "",
    format,
    customFormatName: typeof input.customFormatName === "string" ? input.customFormatName : "",
    holes: Number.isFinite(input.holes) ? Number(input.holes) : 18,
    playMode: input.playMode === "team" ? "team" : "individual",
    ballsCount: Number.isFinite(input.ballsCount) ? Number(input.ballsCount) : 0,
    scoringModel: normalizeScoringModel(input.scoringModel),
    parts: [],
    schedule: Array.isArray(input.schedule) ? input.schedule : [],
    sortOrder: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : index,
  };

  round.parts = Array.isArray(input.parts) ? input.parts.map((part, partIndex) => normalizeRoundPart(part, round, partIndex)) : [];
  return round;
}

export function normalizeSlug(value: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || `tavling-${Date.now()}`;
}

export function normalizeConfig(value: unknown): OtherCompetitionConfig {
  const input = typeof value === "object" && value !== null ? (value as Partial<OtherCompetitionConfig>) : {};

  return {
    ...EMPTY_OTHER_COMPETITION_CONFIG,
    ...input,
    version: 1,
    players: Array.isArray(input.players) ? input.players : [],
    teams: Array.isArray(input.teams) ? input.teams : [],
    rounds: Array.isArray(input.rounds) ? input.rounds.map(normalizeRound) : [],
    results: typeof input.results === "object" && input.results !== null ? input.results : {},
    finalPlacementOverrides:
      typeof input.finalPlacementOverrides === "object" && input.finalPlacementOverrides !== null
        ? input.finalPlacementOverrides
        : {},
    settings: {
      ...EMPTY_OTHER_COMPETITION_CONFIG.settings,
      ...(typeof input.settings === "object" && input.settings !== null ? input.settings : {}),
    },
  };
}

export function normalizeCompetitionRow(row: Record<string, unknown>): OtherCompetitionRow {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    subtitle: row.subtitle ? String(row.subtitle) : null,
    location: row.location ? String(row.location) : null,
    starts_on: row.starts_on ? String(row.starts_on) : null,
    ends_on: row.ends_on ? String(row.ends_on) : null,
    status: isStatus(row.status) ? row.status : "draft",
    card_image_url: row.card_image_url ? String(row.card_image_url) : null,
    header_image_url: row.header_image_url ? String(row.header_image_url) : null,
    rules_content: row.rules_content ? String(row.rules_content) : "",
    config: normalizeConfig(row.config),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    published_at: row.published_at ? String(row.published_at) : null,
    locked_at: row.locked_at ? String(row.locked_at) : null,
  };
}

export function statusLabel(status: OtherCompetitionStatus) {
  if (status === "draft") return "Utkast";
  if (status === "published") return "Publicerad";
  if (status === "live") return "Pågår";
  return "Slutförd/Låst";
}

export function publicStatus(status: OtherCompetitionStatus) {
  return status !== "draft";
}

export function formatDateRange(start: string | null, end: string | null) {
  if (!start && !end) return "Datum ej satt";
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  const startLabel = start ? new Date(`${start}T12:00:00`).toLocaleDateString("sv-SE", opts) : "";
  const endLabel = end ? new Date(`${end}T12:00:00`).toLocaleDateString("sv-SE", opts) : "";
  if (start && end && start !== end) return `${startLabel} - ${endLabel}`;
  return startLabel || endLabel;
}

export function daysUntil(start: string | null) {
  if (!start) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${start}T00:00:00`);
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / 86_400_000);
}
