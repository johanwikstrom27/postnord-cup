import type { OtherCompetitionConfig, OtherCompetitionFormat, OtherCompetitionRound, OtherCompetitionScoringModel } from "@/lib/otherCompetitions/types";
import { defaultResultDisplayForFormat, formatLabel } from "@/lib/otherCompetitions/templates";
import { scoringModelForUnit, scoringUnitsForRound } from "@/lib/otherCompetitions/scoring";

function resolvedResultDisplay(format: OtherCompetitionFormat, model: OtherCompetitionScoringModel) {
  return model.resultDisplay ?? defaultResultDisplayForFormat(format);
}

function detailedFormatLabel(format: OtherCompetitionFormat, model: OtherCompetitionScoringModel, customName?: string) {
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

function roundHolesSummary(round: OtherCompetitionRound) {
  const parts = (round.parts ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  if (parts.length >= 2) return `${parts.map((part) => part.holes).join("+")} hål`;
  return `${round.holes} hål`;
}

function placementDistribution(model: OtherCompetitionScoringModel) {
  const values = model.placementPoints.filter((value) => Number.isFinite(value));
  if (values.length === 0) return "";
  return values.map((value) => `${value}p`).join(", ");
}

function unitScoringText(
  round: OtherCompetitionRound,
  format: OtherCompetitionFormat,
  model: OtherCompetitionScoringModel
) {
  if (model.kind === "match") {
    if (resolvedResultDisplay(format, model) === "points") {
      return `Resultatet avgörs av lagets score på delen. Vinst ${model.winPoints}p, delad ${model.drawPoints}p, förlust ${model.lossPoints}p.`;
    }
    return `Vinst ${model.winPoints}p, delad ${model.drawPoints}p, förlust ${model.lossPoints}p.`;
  }

  if (model.kind === "placement") {
    const distribution = placementDistribution(model);
    if ((model.placementMetric ?? "points") === "strokes") {
      const prefix = round.playMode === "team" ? "Lagets totalscore i slag rankas." : "Lägst slag vinner.";
      return distribution ? `${prefix} Placering ger ${distribution}.` : prefix;
    }
    const prefix =
      round.playMode === "team"
        ? "Lagets sammanlagda poäng rankas."
        : "Spelarnas poäng rankas.";
    return distribution ? `${prefix} Placering ger ${distribution}.` : prefix;
  }

  if (model.kind === "manual") return "Tabellpoäng sätts manuellt av admin.";
  return model.customText.trim() || "Poäng och upplägg anges särskilt av admin.";
}

function roundLines(round: OtherCompetitionRound) {
  const units = scoringUnitsForRound(round);
  const parts = units.map((unit) => {
    const format = unit.part?.format ?? round.format;
    const model = scoringModelForUnit(unit);
    const label = unit.part?.name ?? "Hela rundan";
    const holes = unit.part ? `${unit.part.holes} hål` : roundHolesSummary(round);
    return `- ${label}: ${detailedFormatLabel(format, model, unit.part?.customFormatName ?? round.customFormatName)} (${holes}). ${unitScoringText(round, format, model)}`;
  });

  return [`${round.name} - ${roundHolesSummary(round)}`, ...parts];
}

export function buildCompetitionRulesDraft(config: OtherCompetitionConfig) {
  const rounds = config.rounds.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const teamCompetition = config.teams.length > 0 && config.settings.isTeamCompetition !== false;

  const intro = [
    "TÄVLINGSFORMAT",
    teamCompetition
      ? "- Tävlingen spelas som 2-mannalag där varje runda ger tabellpoäng till laget."
      : "- Tävlingen spelas individuellt där varje runda ger tabellpoäng.",
    "- HCP appliceras enligt standardformatet i GameBook för respektive spelform.",
    "- Spelschemat visar bara bollindelning och vilka som spelar tillsammans i varje boll.",
    "- Den här sidan är främst till för en övergripande tabellställning och spelschema.",
  ];

  const results = [
    "RESULTAT OCH VISNING",
    "- Resultatlistan visar lagets eller spelarens tabellpoäng för rundan.",
    "- Vid poängbogey visas även spelarnas summering, till exempel 36 + 42 = 78p.",
    "- Vid uppdelade rundor visas även delpoäng, till exempel Hål 1-9: 2p · Hål 10-18: 3p.",
    "- I GameBook kan du följa resultaten mer i detalj, hål för hål och per del där det finns stöd för det.",
    "- Vid oavgjort i totalställningen efter alla rundor används bäst ackumulerad poängbogey på sista rundan som tie-break för förstaplatsen.",
  ];

  const roundsSection =
    rounds.length > 0
      ? ["RUNDOR", ...rounds.flatMap((round) => ["", ...roundLines(round)])]
      : ["RUNDOR", "", "- Lägg till rundor i admin för att bygga ett automatiskt första utkast här."];

  return [...intro, "", ...roundsSection, "", ...results].join("\n");
}
