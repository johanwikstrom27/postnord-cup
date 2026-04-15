export type OtherCompetitionStatus = "draft" | "published" | "live" | "locked";

export type OtherCompetitionPlayer = {
  id: string;
  name: string;
  avatarUrl: string | null;
  sourcePersonId: string | null;
  sourceLabel: "postnord" | "external";
  hcp?: number | null;
  sortOrder: number;
};

export type OtherCompetitionTeam = {
  id: string;
  name: string;
  color: string;
  icon?: string;
  targetSize?: number;
  memberIds: string[];
  sortOrder: number;
};

export type OtherCompetitionPlayMode = "individual" | "team";

export type OtherCompetitionFormat =
  | "stableford"
  | "greensome"
  | "best_ball"
  | "scramble"
  | "single_match"
  | "switch_match_9"
  | "team_match"
  | "stroke_play"
  | "foursome"
  | "shamble"
  | "texas_scramble"
  | "eclectic"
  | "custom";

export type OtherCompetitionScoringModel = {
  kind: "placement" | "match" | "manual" | "custom";
  placementPoints: number[];
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  maxPoints: number | null;
  bonusPoints: number;
  customText: string;
};

export type OtherCompetitionSchedulePairing = {
  id: string;
  segment: "front_9" | "back_9";
  playerIds: string[];
  resultLabel: string;
};

export type OtherCompetitionScheduleItem = {
  id: string;
  time: string;
  title: string;
  competitorIds: string[];
  pairings?: OtherCompetitionSchedulePairing[];
  note: string;
};

export type OtherCompetitionRoundPart = {
  id: string;
  name: string;
  format: OtherCompetitionFormat;
  customFormatName: string;
  holes: number;
  scoringModel: OtherCompetitionScoringModel;
  sortOrder: number;
};

export type OtherCompetitionRound = {
  id: string;
  name: string;
  date: string;
  format: OtherCompetitionFormat;
  customFormatName: string;
  holes: number;
  playMode: OtherCompetitionPlayMode;
  ballsCount: number;
  scoringModel: OtherCompetitionScoringModel;
  parts?: OtherCompetitionRoundPart[];
  schedule: OtherCompetitionScheduleItem[];
  sortOrder: number;
};

export type OtherCompetitionResult = {
  competitorId: string;
  scoreLabel: string;
  rawScore: number | null;
  playerScores?: Record<string, number | null>;
  points: number;
  adjustment: number;
  bonus: number;
  placementOverride: number | null;
  winnerOverride: boolean;
  note: string;
};

export type OtherCompetitionConfig = {
  version: 1;
  players: OtherCompetitionPlayer[];
  teams: OtherCompetitionTeam[];
  rounds: OtherCompetitionRound[];
  results: Record<string, OtherCompetitionResult[]>;
  finalPlacementOverrides: Record<string, number | null>;
  settings: {
    teamSize?: number;
    plannedPlayerCount?: number;
    plannedTeamCount?: number;
    isTeamCompetition?: boolean;
  };
};

export type OtherCompetitionRow = {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  location: string | null;
  starts_on: string | null;
  ends_on: string | null;
  status: OtherCompetitionStatus;
  card_image_url: string | null;
  header_image_url: string | null;
  rules_content: string;
  config: OtherCompetitionConfig;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  locked_at: string | null;
};

export type PostNordPersonSnapshot = {
  id: string;
  name: string;
  avatar_url: string | null;
};
