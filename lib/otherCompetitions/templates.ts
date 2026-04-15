import type {
  OtherCompetitionFormat,
  OtherCompetitionRound,
  OtherCompetitionScoringModel,
} from "@/lib/otherCompetitions/types";

export const FORMAT_OPTIONS: Array<{
  value: OtherCompetitionFormat;
  label: string;
  defaultMode: "individual" | "team";
  scoringKind: OtherCompetitionScoringModel["kind"];
}> = [
  { value: "stableford", label: "Poängbogey / Stableford", defaultMode: "individual", scoringKind: "placement" },
  { value: "greensome", label: "Greensome", defaultMode: "team", scoringKind: "placement" },
  { value: "best_ball", label: "Bästboll", defaultMode: "team", scoringKind: "placement" },
  { value: "scramble", label: "Scramble", defaultMode: "team", scoringKind: "placement" },
  { value: "single_match", label: "Singelmatchspel", defaultMode: "individual", scoringKind: "match" },
  { value: "switch_match_9", label: "Matchspel byte efter 9 hål", defaultMode: "individual", scoringKind: "match" },
  { value: "team_match", label: "Lagmatchspel", defaultMode: "team", scoringKind: "match" },
  { value: "stroke_play", label: "Slagspel", defaultMode: "individual", scoringKind: "placement" },
  { value: "foursome", label: "Foursome / Alternate shot", defaultMode: "team", scoringKind: "placement" },
  { value: "shamble", label: "Shamble", defaultMode: "team", scoringKind: "placement" },
  { value: "texas_scramble", label: "Texas Scramble", defaultMode: "team", scoringKind: "placement" },
  { value: "eclectic", label: "Eclectic", defaultMode: "individual", scoringKind: "placement" },
  { value: "custom", label: "Custom / eget format", defaultMode: "individual", scoringKind: "custom" },
];

export function formatLabel(format: OtherCompetitionFormat, customName?: string) {
  if (format === "custom" && customName) return customName;
  return FORMAT_OPTIONS.find((item) => item.value === format)?.label ?? format;
}

export function defaultScoringModel(kind: OtherCompetitionScoringModel["kind"] = "placement"): OtherCompetitionScoringModel {
  return {
    kind,
    placementPoints: kind === "match" ? [] : [6, 5, 4, 3, 2, 1],
    winPoints: 2,
    drawPoints: 1,
    lossPoints: 0,
    maxPoints: null,
    bonusPoints: 0,
    customText: "",
  };
}

export function createRound(format: OtherCompetitionFormat, order: number): OtherCompetitionRound {
  const option = FORMAT_OPTIONS.find((item) => item.value === format) ?? FORMAT_OPTIONS[0];

  return {
    id: crypto.randomUUID(),
    name: `Runda ${order + 1}`,
    date: "",
    format,
    customFormatName: "",
    holes: 18,
    playMode: option.defaultMode,
    ballsCount: 0,
    scoringModel: defaultScoringModel(option.scoringKind),
    parts: [],
    schedule: [],
    locked: false,
    lockedAt: null,
    sortOrder: order,
  };
}
