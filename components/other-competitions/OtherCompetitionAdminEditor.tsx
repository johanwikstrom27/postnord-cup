"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  OtherCompetitionConfig,
  OtherCompetitionPlayer,
  OtherCompetitionResult,
  OtherCompetitionRow,
  OtherCompetitionRound,
  OtherCompetitionScheduleItemMatchResult,
  OtherCompetitionScoringModel,
  OtherCompetitionScheduleItem,
  OtherCompetitionSchedulePairing,
  OtherCompetitionStatus,
  OtherCompetitionTeam,
  PostNordPersonSnapshot,
} from "@/lib/otherCompetitions/types";
import { normalizeConfig, normalizeSlug, statusLabel } from "@/lib/otherCompetitions/data";
import { FORMAT_OPTIONS, createRound, defaultPlacementMetricForFormat, defaultResultDisplayForFormat, defaultScoringModel, formatLabel } from "@/lib/otherCompetitions/templates";
import {
  type Competitor,
  allScoringUnits,
  competitorsForRound,
  rankEntries,
  scoringModelForUnit,
  scoringUnitsForRound,
  teamDisplayName,
} from "@/lib/otherCompetitions/scoring";

type Tab = "basic" | "players" | "teams" | "schedule" | "results" | "rules";

type DraftCompetition = {
  name: string;
  slug: string;
  subtitle: string;
  location: string;
  starts_on: string;
  ends_on: string;
  status: OtherCompetitionStatus;
  card_image_url: string;
  header_image_url: string;
  rules_content: string;
};

const TABS: Tab[] = ["basic", "players", "teams", "schedule", "results", "rules"];

function tabLabel(tab: Tab) {
  if (tab === "basic") return "Översikt";
  if (tab === "players") return "Spelare";
  if (tab === "teams") return "Lag";
  if (tab === "schedule") return "Spelschema";
  if (tab === "results") return "Resultat";
  return "Stadgar";
}

function inputClass(disabled = false) {
  return [
    "min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-white/30",
    disabled ? "cursor-not-allowed opacity-55" : "",
  ].join(" ");
}

function buttonClass(tone: "default" | "primary" | "danger" | "success" = "default") {
  if (tone === "danger") {
    return "rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/18";
  }
  if (tone === "success") {
    return "rounded-2xl border border-emerald-300/30 bg-emerald-400/12 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/18";
  }
  if (tone === "primary") {
    return "rounded-2xl border border-sky-300/30 bg-sky-400/12 px-4 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-400/18";
  }
  return "rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10";
}

function placeLabel(index: number) {
  if (index === 0) return "1:a";
  if (index === 1) return "2:a";
  return `${index + 1}:e`;
}

function parsePointDistribution(value: string) {
  return value
    .split(/[-,;\s]+/)
    .map((item) => Number(item.replace(",", ".")))
    .filter((item) => Number.isFinite(item));
}

function isMatchRound(round: OtherCompetitionRound) {
  return round.scoringModel.kind === "match" || ["single_match", "switch_match_9", "team_match"].includes(round.format);
}

function usesTeamPoolForMatchRound(round: OtherCompetitionRound, teamCount: number) {
  if (teamCount <= 0) return false;
  if (round.format === "single_match" || round.format === "switch_match_9") return true;
  return (round.parts ?? []).some((part) => (part.format ?? round.format) === "single_match" || (part.format ?? round.format) === "switch_match_9");
}

function scoringKindLabel(kind: OtherCompetitionRound["scoringModel"]["kind"]) {
  if (kind === "placement") return "Tabellpoäng efter placering";
  if (kind === "match") return "Matchpoäng";
  if (kind === "manual") return "Manuell tabellpoäng";
  return "Eget upplägg";
}

function resultScoreLabel(
  round: OtherCompetitionRound,
  format = round.format,
  model: OtherCompetitionScoringModel = round.scoringModel
) {
  if (model.kind === "match") {
    if (resolvedResultDisplay(format, model) === "points") return "Poängbogey totalt";
    return "Matchresultat";
  }
  if ((model.placementMetric ?? defaultPlacementMetricForFormat(format)) === "strokes") return "Slag totalt";
  if ((model.placementMetric ?? defaultPlacementMetricForFormat(format)) === "points") return "Poängbogey totalt";
  return "Resultat i spelet";
}

function resolvedResultDisplay(format: OtherCompetitionRound["format"], model: OtherCompetitionScoringModel) {
  return model.resultDisplay ?? defaultResultDisplayForFormat(format);
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function matchMarginLabel(pairing: Pick<OtherCompetitionSchedulePairing, "matchPoints" | "holesRemaining">) {
  const matchPoints = Number(pairing.matchPoints ?? 0);
  const holesRemaining = Number(pairing.holesRemaining ?? 0);
  if (!Number.isFinite(matchPoints) || matchPoints <= 0) return "";
  if (!Number.isFinite(holesRemaining) || holesRemaining <= 0) return `${matchPoints}up`;
  return `${matchPoints}&${holesRemaining}`;
}

function buildPairingResultLabel(
  pairing: Pick<OtherCompetitionSchedulePairing, "winnerId" | "halved" | "matchPoints" | "holesRemaining">,
  playerNamesById: Map<string, string>
) {
  if (pairing.halved) return "Delad match";
  if (!pairing.winnerId) return "";
  const winnerName = playerNamesById.get(pairing.winnerId);
  if (!winnerName) return "";
  const margin = matchMarginLabel(pairing);
  return margin ? `${firstName(winnerName)} ${margin}` : `${firstName(winnerName)} vann`;
}

function usesStructuredTeamMatchResults(
  round: OtherCompetitionRound,
  model: OtherCompetitionScoringModel,
  format: OtherCompetitionRound["format"] = round.format
) {
  return (
    round.playMode === "team" &&
    model.kind === "match" &&
    resolvedResultDisplay(format, model) === "match" &&
    matchPairingSegments(round).length === 1 &&
    format !== "single_match"
  );
}

function usesScoreComparedTeamMatchResults(
  round: OtherCompetitionRound,
  model: OtherCompetitionScoringModel,
  format: OtherCompetitionRound["format"] = round.format
) {
  return (
    round.playMode === "team" &&
    model.kind === "match" &&
    format === "best_ball" &&
    resolvedResultDisplay(format, model) === "points" &&
    matchPairingSegments(round).length === 1
  );
}

function usesAnyTeamMatchMode(round: OtherCompetitionRound) {
  return round.playMode === "team" && (round.scoringModel.kind === "match" || (round.parts ?? []).some((part) => part.scoringModel.kind === "match"));
}

function usesPlayerBallScores(format: OtherCompetitionRound["format"]) {
  return ["stableford", "stroke_play", "eclectic"].includes(format);
}

function scoringKindOptionsForFormat(format: OtherCompetitionRound["format"]) {
  if (format === "greensome") return ["match", "manual", "custom"] as OtherCompetitionScoringModel["kind"][];
  if (format === "scramble") return ["placement", "manual", "custom"] as OtherCompetitionScoringModel["kind"][];
  if (format === "best_ball") return ["match", "manual", "custom"] as OtherCompetitionScoringModel["kind"][];
  if (format === "single_match" || format === "switch_match_9" || format === "team_match") return ["match", "manual", "custom"] as OtherCompetitionScoringModel["kind"][];
  return ["placement", "match", "manual", "custom"] as OtherCompetitionScoringModel["kind"][];
}

function teamMatchResultLabel(
  item: Pick<OtherCompetitionScheduleItemMatchResult, "matchWinnerCompetitorId" | "matchHalved" | "matchPoints" | "holesRemaining">,
  competitorNamesById: Map<string, string>
) {
  if (item.matchHalved) return "Delad match";
  if (!item.matchWinnerCompetitorId) return "";
  const winnerName = competitorNamesById.get(item.matchWinnerCompetitorId);
  if (!winnerName) return "";
  const matchPoints = Number(item.matchPoints ?? 0);
  const holesRemaining = Number(item.holesRemaining ?? 0);
  const margin = matchPoints > 0 ? (holesRemaining > 0 ? `${matchPoints}&${holesRemaining}` : `${matchPoints}up`) : "";
  return margin ? `${firstName(winnerName)} ${margin}` : `${firstName(winnerName)} vann`;
}

function normalizeTeamMatchResult(
  value: Partial<OtherCompetitionScheduleItemMatchResult> | undefined,
  competitorIds: string[],
  competitorNamesById: Map<string, string>
): OtherCompetitionScheduleItemMatchResult {
  const matchWinnerCompetitorId = competitorIds.includes(value?.matchWinnerCompetitorId ?? "") ? value?.matchWinnerCompetitorId ?? null : null;
  const matchHalved = competitorIds.length >= 2 ? Boolean(value?.matchHalved) && !matchWinnerCompetitorId : false;
  const matchPoints =
    typeof value?.matchPoints === "number" && Number.isFinite(value.matchPoints) && value.matchPoints > 0 ? value.matchPoints : null;
  const holesRemaining =
    typeof value?.holesRemaining === "number" && Number.isFinite(value.holesRemaining) && value.holesRemaining >= 0 ? value.holesRemaining : null;

  return {
    matchWinnerCompetitorId,
    matchHalved,
    matchPoints,
    holesRemaining,
    matchResultLabel:
      teamMatchResultLabel({ matchWinnerCompetitorId, matchHalved, matchPoints, holesRemaining }, competitorNamesById) ||
      (!matchWinnerCompetitorId && !matchHalved ? value?.matchResultLabel ?? "" : ""),
  };
}

function unitFormat(unit: { round: OtherCompetitionRound; part: NonNullable<OtherCompetitionRound["parts"]>[number] | null }) {
  return unit.part?.format ?? unit.round.format;
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

function segmentLabel(segment: OtherCompetitionSchedulePairing["segment"]) {
  return segment === "front_9" ? "Första 9" : "Bakre 9";
}

function partFormatLabel(part: NonNullable<OtherCompetitionRound["parts"]>[number], round: OtherCompetitionRound) {
  return formatLabel(part.format ?? round.format, part.customFormatName);
}

function roundFormatSummary(round: OtherCompetitionRound) {
  const parts = (round.parts ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  if (parts.length > 0) return parts.map((part) => partFormatLabel(part, round)).join(" + ");
  return formatLabel(round.format, round.customFormatName);
}

function PlacementPointsEditor({
  points,
  disabled,
  onChange,
}: {
  points: number[];
  disabled: boolean;
  onChange: (points: number[]) => void;
}) {
  const nextPoints = points.length > 0 ? points : [6, 5, 4, 3, 2, 1];

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
      <div className="grid grid-cols-[minmax(0,1fr)_120px_48px] border-b border-white/10 px-3 py-2 text-xs uppercase tracking-[0.16em] text-white/45">
        <div>Placering</div>
        <div className="text-right">Tabellpoäng</div>
        <div />
      </div>
      {nextPoints.map((point, index) => (
        <div key={index} className="grid grid-cols-[minmax(0,1fr)_120px_48px] items-center gap-2 border-b border-white/10 px-3 py-2 last:border-b-0">
          <div className="font-medium text-white/82">{placeLabel(index)}</div>
          <input
            disabled={disabled}
            type="number"
            value={point}
            onChange={(e) => {
              const updated = nextPoints.slice();
              updated[index] = Number(e.target.value) || 0;
              onChange(updated);
            }}
            className="min-h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-right text-sm outline-none focus:border-white/30"
          />
          <button
            type="button"
            disabled={disabled || nextPoints.length <= 1}
            onClick={() => onChange(nextPoints.filter((_, itemIndex) => itemIndex !== index))}
            className="h-10 rounded-xl border border-white/10 bg-white/5 text-sm text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            x
          </button>
        </div>
      ))}
      <div className="flex flex-col gap-2 border-t border-white/10 p-3 sm:flex-row">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...nextPoints, Math.max(0, (nextPoints.at(-1) ?? 1) - 1)])}
          className={buttonClass()}
        >
          Lägg till placering
        </button>
        <input
          disabled={disabled}
          value={nextPoints.join("-")}
          onChange={(e) => onChange(parsePointDistribution(e.target.value))}
          className={inputClass(disabled)}
          aria-label="Poängfördelning som text"
        />
      </div>
    </div>
  );
}

function ScoringModelEditor({
  model,
  format,
  disabled,
  onChange,
}: {
  model: OtherCompetitionRound["scoringModel"];
  format: OtherCompetitionRound["format"];
  disabled: boolean;
  onChange: (model: OtherCompetitionRound["scoringModel"]) => void;
}) {
  const kindOptions = scoringKindOptionsForFormat(format);
  const selectedKind = kindOptions.includes(model.kind) ? model.kind : kindOptions[0];
  return (
    <div className="grid gap-4">
      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-white/45">Vad ska delas ut?</span>
        <select
          disabled={disabled}
          value={selectedKind}
          onChange={(e) => onChange({ ...model, kind: e.target.value as OtherCompetitionRound["scoringModel"]["kind"] })}
          className={inputClass(disabled)}
        >
          {kindOptions.includes("placement") ? <option value="placement">Tabellpoäng efter placering</option> : null}
          {kindOptions.includes("match") ? <option value="match">Matchpoäng: vinst / oavgjort / förlust</option> : null}
          {kindOptions.includes("manual") ? <option value="manual">Manuell tabellpoäng</option> : null}
          {kindOptions.includes("custom") ? <option value="custom">Eget upplägg</option> : null}
        </select>
      </label>

      {model.kind === "placement" ? (
        <div className="space-y-2">
          {(format === "scramble" || format === "stroke_play" || format === "stableford") ? (
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-white/45">Resultattyp</span>
              <select
                disabled={disabled}
                value={model.placementMetric ?? defaultPlacementMetricForFormat(format)}
                onChange={(e) => onChange({ ...model, placementMetric: e.target.value === "strokes" ? "strokes" : "points" })}
                className={inputClass(disabled)}
              >
                <option value="points">Poängbogey</option>
                {(format === "scramble" || format === "stroke_play") ? <option value="strokes">Slag</option> : null}
              </select>
            </label>
          ) : null}
          <div className="text-xs uppercase tracking-[0.18em] text-white/45">Poängfördelning</div>
          <PlacementPointsEditor
            points={model.placementPoints}
            disabled={disabled}
            onChange={(placementPoints) => onChange({ ...model, placementPoints })}
          />
        </div>
      ) : null}

      {model.kind === "match" ? (
        <div className="grid gap-3">
          {format === "best_ball" ? (
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-white/45">Resultat visas som</span>
              <select
                disabled={disabled}
                value={resolvedResultDisplay(format, model)}
                onChange={(e) => onChange({ ...model, resultDisplay: e.target.value === "match" ? "match" : "points" })}
                className={inputClass(disabled)}
              >
                <option value="points">Poängbogey</option>
                <option value="match">Matchspel</option>
              </select>
            </label>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-white/45">Vinst</span>
              <input disabled={disabled} type="number" value={model.winPoints} onChange={(e) => onChange({ ...model, winPoints: Number(e.target.value) || 0 })} className={inputClass(disabled)} />
            </label>
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-white/45">Oavgjort</span>
              <input disabled={disabled} type="number" value={model.drawPoints} onChange={(e) => onChange({ ...model, drawPoints: Number(e.target.value) || 0 })} className={inputClass(disabled)} />
            </label>
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-white/45">Förlust</span>
              <input disabled={disabled} type="number" value={model.lossPoints} onChange={(e) => onChange({ ...model, lossPoints: Number(e.target.value) || 0 })} className={inputClass(disabled)} />
            </label>
          </div>
        </div>
      ) : null}

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-white/45">
          {model.kind === "placement" ? "Särspel och specialregler" : "Regler och specialfall"}
        </span>
        <textarea
          disabled={disabled}
          value={model.customText}
          onChange={(e) => onChange({ ...model, customText: e.target.value })}
          placeholder="Exempel: vid lika poäng avgör sista 9, särspel eller manuellt beslut."
          className={`${inputClass(disabled)} min-h-24`}
        />
      </label>
    </div>
  );
}

const TEAM_ICONS = ["◆", "●", "▲", "■", "✦", "✚", "⬟", "★", "◇", "⬢", "✹", "✶"];
const TEAM_COLORS = [
  "#2dd4bf",
  "#60a5fa",
  "#f59e0b",
  "#f472b6",
  "#a3e635",
  "#c084fc",
  "#fb7185",
  "#34d399",
  "#facc15",
  "#38bdf8",
  "#fb923c",
  "#a78bfa",
];

function teamIconForIndex(index: number) {
  return TEAM_ICONS[index % TEAM_ICONS.length];
}

function teamColorForIndex(index: number) {
  return TEAM_COLORS[index % TEAM_COLORS.length];
}

function teamTargetSize(team: OtherCompetitionTeam) {
  return Math.max(1, Number(team.targetSize ?? 0) || team.memberIds.length || 1);
}

function TeamPill({ competitor }: { competitor: Pick<Competitor, "teamName" | "teamColor" | "teamIcon"> }) {
  if (!competitor.teamName) return null;
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium text-white/84"
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

function fmtTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("sv-SE", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtPoints(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}

function toDraft(row: OtherCompetitionRow): DraftCompetition {
  return {
    name: row.name,
    slug: row.slug,
    subtitle: row.subtitle ?? "",
    location: row.location ?? "",
    starts_on: row.starts_on ?? "",
    ends_on: row.ends_on ?? "",
    status: row.status,
    card_image_url: row.card_image_url ?? "",
    header_image_url: row.header_image_url ?? "",
    rules_content: row.rules_content ?? "",
  };
}

function createResult(competitorId: string): OtherCompetitionResult {
  return {
    competitorId,
    scoreLabel: "",
    rawScore: null,
    playerScores: {},
    points: 0,
    adjustment: 0,
    bonus: 0,
    placementOverride: null,
    winnerOverride: false,
    note: "",
  };
}

function sortedPlayers(players: OtherCompetitionPlayer[]) {
  return players.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "sv"));
}

function sortedTeams(teams: OtherCompetitionTeam[]) {
  return teams.slice().sort((a, b) => a.sortOrder - b.sortOrder);
}

function sortedRounds(rounds: OtherCompetitionRound[]) {
  return rounds.slice().sort((a, b) => a.sortOrder - b.sortOrder);
}

export default function OtherCompetitionAdminEditor({
  initialCompetition,
  people,
}: {
  initialCompetition: OtherCompetitionRow;
  people: PostNordPersonSnapshot[];
}) {
  const [competition, setCompetition] = useState<DraftCompetition>(() => toDraft(initialCompetition));
  const [config, setConfig] = useState<OtherCompetitionConfig>(() => normalizeConfig(initialCompetition.config));
  const [tab, setTab] = useState<Tab>("basic");
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedRoundId, setSelectedRoundId] = useState(initialCompetition.config.rounds[0]?.id ?? "");
  const [selectedResultKey, setSelectedResultKey] = useState(initialCompetition.config.rounds[0]?.id ?? "");
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const dirtyRef = useRef(false);
  const locked = competition.status === "locked";

  const rounds = useMemo(() => sortedRounds(config.rounds), [config.rounds]);
  const selectedRound = rounds.find((round) => round.id === selectedRoundId) ?? rounds[0] ?? null;
  const scoringUnits = useMemo(() => allScoringUnits(config), [config]);
  const selectedScoringUnit =
    scoringUnits.find((unit) => unit.resultKey === selectedResultKey) ??
    (selectedRound ? scoringUnitsForRound(selectedRound)[0] : null);
  function isRoundLocked(round: OtherCompetitionRound) {
    return locked || Boolean(round.locked);
  }

  function markDirty() {
    dirtyRef.current = true;
    setSaveState("dirty");
  }

  function patchCompetition(patch: Partial<DraftCompetition>) {
    setCompetition((prev) => ({ ...prev, ...patch }));
    markDirty();
  }

  function patchConfig(updater: (prev: OtherCompetitionConfig) => OtherCompetitionConfig) {
    setConfig((prev) => updater(normalizeConfig(prev)));
    markDirty();
  }

  const saveNow = useCallback(async (nextCompetition = competition, nextConfig = config) => {
    setSaveState("saving");
    setSaveMessage("");

    try {
      const res = await fetch(`/api/admin/other-competitions/${initialCompetition.id}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competition: nextCompetition,
          config: normalizeConfig(nextConfig),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; competition?: OtherCompetitionRow };

      if (!res.ok) {
        setSaveState("error");
        setSaveMessage(data.error ?? "Kunde inte spara.");
        return;
      }

      if (data.competition) {
        setCompetition(toDraft(data.competition));
        setConfig(normalizeConfig(data.competition.config));
      }
      dirtyRef.current = false;
      setSaveState("saved");
      setSaveMessage(`Sparad ${new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}`);
    } catch (error) {
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "Nätverksfel");
    }
  }, [competition, config, initialCompetition.id]);

  useEffect(() => {
    if (!dirtyRef.current || locked) return;
    const timer = window.setTimeout(() => void saveNow(), 1100);
    return () => window.clearTimeout(timer);
  }, [competition, config, locked, saveNow]);

  function setStatus(status: OtherCompetitionStatus) {
    const next = { ...competition, status };
    setCompetition(next);
    dirtyRef.current = true;
    void saveNow(next, config);
  }

  function addExternalPlayer() {
    if (locked) return;
    const name = window.prompt("Namn på extern spelare");
    if (!name?.trim()) return;
    patchConfig((prev) => ({
      ...prev,
      players: [
        ...prev.players,
        {
          id: crypto.randomUUID(),
          name: name.trim(),
          avatarUrl: null,
          sourcePersonId: null,
          sourceLabel: "external",
          sortOrder: prev.players.length,
        },
      ],
    }));
  }

  function importPerson() {
    if (locked || !selectedPersonId) return;
    const person = people.find((item) => item.id === selectedPersonId);
    if (!person) return;

    patchConfig((prev) => {
      if (prev.players.some((player) => player.sourcePersonId === person.id)) return prev;
      return {
        ...prev,
        players: [
          ...prev.players,
          {
            id: crypto.randomUUID(),
            name: person.name,
            avatarUrl: person.avatar_url,
            sourcePersonId: person.id,
            sourceLabel: "postnord",
            sortOrder: prev.players.length,
          },
        ],
      };
    });
    setSelectedPersonId("");
  }

  function patchPlayer(playerId: string, patch: Partial<OtherCompetitionPlayer>) {
    patchConfig((prev) => ({
      ...prev,
      players: prev.players.map((player) => (player.id === playerId ? { ...player, ...patch } : player)),
    }));
  }

  function removePlayer(playerId: string) {
    if (locked) return;
    patchConfig((prev) => ({
      ...prev,
      players: prev.players.filter((player) => player.id !== playerId),
      teams: prev.teams.map((team) => ({
        ...team,
        memberIds: team.memberIds.filter((id) => id !== playerId),
      })),
    }));
  }

  function addTeam() {
    if (locked) return;
    patchConfig((prev) => ({
      ...prev,
      teams: [
        ...prev.teams,
        {
          id: crypto.randomUUID(),
          name: "",
          color: teamColorForIndex(prev.teams.length),
          icon: teamIconForIndex(prev.teams.length),
          targetSize: Math.max(1, Number(prev.settings.teamSize ?? 2)),
          memberIds: [],
          sortOrder: prev.teams.length,
        },
      ],
      settings: { ...prev.settings, isTeamCompetition: true },
    }));
  }

  function generateTeams() {
    if (locked) return;
    const plannedPlayers = Math.max(1, Number(config.settings.plannedPlayerCount ?? config.players.length ?? 12));
    const plannedTeams = Math.max(1, Number(config.settings.plannedTeamCount ?? 1));
    const teamSize = Math.max(1, Math.ceil(plannedPlayers / plannedTeams));
    const teams: OtherCompetitionTeam[] = [];

    for (let index = 0; index < plannedTeams; index += 1) {
      teams.push({
        id: crypto.randomUUID(),
        name: "",
        color: teamColorForIndex(index),
        icon: teamIconForIndex(index),
        targetSize: teamSize,
        memberIds: [],
        sortOrder: teams.length,
      });
    }

    patchConfig((prev) => ({ ...prev, teams, settings: { ...prev.settings, teamSize, isTeamCompetition: true } }));
  }

  function clearTeams() {
    if (locked) return;
    patchConfig((prev) => ({
      ...prev,
      teams: [],
      finalPlacementOverrides: {},
    }));
  }

  function patchTeam(teamId: string, patch: Partial<OtherCompetitionTeam>) {
    patchConfig((prev) => ({
      ...prev,
      teams: prev.teams.map((team) => (team.id === teamId ? { ...team, ...patch } : team)),
    }));
  }

  function removeTeam(teamId: string) {
    if (locked) return;
    patchConfig((prev) => ({
      ...prev,
      teams: prev.teams.filter((team) => team.id !== teamId),
    }));
  }

  function playerTeamId(playerId: string, teams = config.teams) {
    return teams.find((team) => team.memberIds.includes(playerId))?.id ?? "";
  }

  function playerTeam(playerId: string, teams = config.teams) {
    return teams.find((team) => team.memberIds.includes(playerId)) ?? null;
  }

  function teamMembers(teamId: string) {
    const team = config.teams.find((item) => item.id === teamId);
    return (team?.memberIds ?? [])
      .map((id) => config.players.find((player) => player.id === id))
      .filter((player): player is OtherCompetitionPlayer => Boolean(player));
  }

  function teamCompetitor(team: OtherCompetitionTeam): Competitor {
    const members = teamMembers(team.id);
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

  function scheduleCompetitorsForRound(round: OtherCompetitionRound) {
    if (usesTeamPoolForMatchRound(round, config.teams.length)) {
      return sortedTeams(config.teams).map(teamCompetitor);
    }
    return competitorsForRound(config, round);
  }

  function pairingPlayersForItem(item: OtherCompetitionScheduleItem) {
    const playerIds = item.competitorIds.flatMap((id) => {
      const team = config.teams.find((row) => row.id === id);
      return team ? team.memberIds : [id];
    });
    return playerIds
      .map((id) => config.players.find((player) => player.id === id))
      .filter((player): player is OtherCompetitionPlayer => Boolean(player));
  }

  function normalizePairingResult(pairing: OtherCompetitionSchedulePairing) {
    const playerNamesById = new Map(config.players.map((player) => [player.id, player.name]));
    const playerIds = pairing.playerIds.map(String).filter(Boolean).slice(0, 2);
    const winnerId = playerIds.includes(pairing.winnerId ?? "") ? pairing.winnerId ?? null : null;
    const halved = playerIds.length === 2 ? Boolean(pairing.halved) && !winnerId : false;
    const matchPoints =
      typeof pairing.matchPoints === "number" && Number.isFinite(pairing.matchPoints) && pairing.matchPoints > 0
        ? pairing.matchPoints
        : null;
    const holesRemaining =
      typeof pairing.holesRemaining === "number" && Number.isFinite(pairing.holesRemaining) && pairing.holesRemaining >= 0
        ? pairing.holesRemaining
        : null;
    const autoLabel = buildPairingResultLabel({ winnerId, halved, matchPoints, holesRemaining }, playerNamesById);

    return {
      ...pairing,
      playerIds,
      winnerId,
      halved,
      matchPoints,
      holesRemaining,
      resultLabel: autoLabel || (!winnerId && !halved ? pairing.resultLabel : ""),
    };
  }

  function normalizeScheduleItemPairings(item: OtherCompetitionScheduleItem) {
    const competitorNamesById = new Map(config.teams.map((team) => [team.id, team.name || teamDisplayName(team, config.players)]));
    const competitorIds = item.competitorIds.map(String).filter(Boolean);
    const baseMatchResult = normalizeTeamMatchResult(item, competitorIds, competitorNamesById);
    const unitMatchResults = Object.fromEntries(
      Object.entries(item.unitMatchResults ?? {}).map(([resultKey, result]) => [resultKey, normalizeTeamMatchResult(result, competitorIds, competitorNamesById)])
    );

    return {
      ...item,
      pairings: (item.pairings ?? []).map(normalizePairingResult),
      matchWinnerCompetitorId: baseMatchResult.matchWinnerCompetitorId ?? null,
      matchHalved: baseMatchResult.matchHalved ?? false,
      matchPoints: baseMatchResult.matchPoints ?? null,
      holesRemaining: baseMatchResult.holesRemaining ?? null,
      matchResultLabel: baseMatchResult.matchResultLabel ?? "",
      unitMatchResults,
    };
  }

  function matchResultForItem(item: OtherCompetitionScheduleItem, resultKey: string, round?: OtherCompetitionRound) {
    if (item.unitMatchResults?.[resultKey]) return normalizeScheduleItemPairings(item).unitMatchResults?.[resultKey] ?? {};
    if ((round?.parts?.length ?? 0) > 0) {
      return {
        matchWinnerCompetitorId: null,
        matchHalved: false,
        matchPoints: null,
        holesRemaining: null,
        matchResultLabel: "",
      };
    }
    return normalizeTeamMatchResult(
      item,
      item.competitorIds.map(String).filter(Boolean),
      new Map(config.teams.map((team) => [team.id, team.name || teamDisplayName(team, config.players)]))
    );
  }

  function matchSegmentsForResultKey(round: OtherCompetitionRound, resultKey: string) {
    const pairingSegments = matchPairingSegments(round);
    if (pairingSegments.length <= 1) return new Set<OtherCompetitionSchedulePairing["segment"]>(["front_9"]);
    const units = scoringUnitsForRound(round);
    if (units.length <= 1) return new Set<OtherCompetitionSchedulePairing["segment"]>(pairingSegments);
    const unitIndex = units.findIndex((unit) => unit.resultKey === resultKey);
    return new Set<OtherCompetitionSchedulePairing["segment"]>([unitIndex <= 0 ? "front_9" : "back_9"]);
  }

  function pairingsForResultKey(round: OtherCompetitionRound, resultKey: string) {
    const segments = matchSegmentsForResultKey(round, resultKey);
    return round.schedule.flatMap((item, itemIndex) =>
      (item.pairings ?? [])
        .filter((pairing) => segments.has(pairing.segment))
        .map((pairing) => ({ item, itemIndex, pairing: normalizePairingResult(pairing) }))
    );
  }

  function deriveMatchResultsForResultKey(nextConfig: OtherCompetitionConfig, round: OtherCompetitionRound, resultKey: string) {
    const unit = scoringUnitsForRound(round).find((item) => item.resultKey === resultKey);
    if (!unit) return nextConfig.results[resultKey] ?? [];

    const model = scoringModelForUnit(unit);
    const format = unitFormat(unit);
    if (usesStructuredTeamMatchResults(round, model, format)) {
      const competitorNamesById = new Map(competitorsForRound(nextConfig, round).map((competitor) => [competitor.id, competitor.name]));
      const existing = new Map((nextConfig.results[resultKey] ?? []).map((result) => [result.competitorId, result]));
      const results = competitorsForRound(nextConfig, round).map((competitor) => ({
        ...createResult(competitor.id),
        ...existing.get(competitor.id),
        competitorId: competitor.id,
        scoreLabel: "",
        rawScore: null,
        playerScores: {},
        points: 0,
        winnerOverride: false,
      }));
      const resultsByCompetitorId = new Map(results.map((result) => [result.competitorId, result]));
      const labelsByCompetitorId = new Map<string, string[]>();
      const addLabel = (competitorId: string, label: string) => {
        if (!label) return;
        labelsByCompetitorId.set(competitorId, [...(labelsByCompetitorId.get(competitorId) ?? []), label]);
      };

      for (const rawItem of round.schedule) {
        const item = normalizeScheduleItemPairings(rawItem);
        const matchResult = matchResultForItem(item, resultKey, round);
        const [competitorAId, competitorBId] = item.competitorIds;
        if (!competitorAId || !competitorBId) continue;
        const competitorAResult = resultsByCompetitorId.get(competitorAId);
        const competitorBResult = resultsByCompetitorId.get(competitorBId);
        if (!competitorAResult || !competitorBResult) continue;
        const competitorAName = competitorNamesById.get(competitorAId) ?? competitorAId;
        const competitorBName = competitorNamesById.get(competitorBId) ?? competitorBId;
        const margin = matchResult.matchPoints
          ? (matchResult.holesRemaining && matchResult.holesRemaining > 0 ? `${matchResult.matchPoints}&${matchResult.holesRemaining}` : `${matchResult.matchPoints}up`)
          : "";

        if (matchResult.matchHalved) {
          competitorAResult.points += model.drawPoints;
          competitorBResult.points += model.drawPoints;
          addLabel(competitorAId, `delad mot ${competitorBName}`);
          addLabel(competitorBId, `delad mot ${competitorAName}`);
          continue;
        }

        if (matchResult.matchWinnerCompetitorId !== competitorAId && matchResult.matchWinnerCompetitorId !== competitorBId) continue;
        const winnerId = matchResult.matchWinnerCompetitorId;
        const loserId = winnerId === competitorAId ? competitorBId : competitorAId;
        const winnerResult = resultsByCompetitorId.get(winnerId);
        const loserResult = resultsByCompetitorId.get(loserId);
        if (!winnerResult || !loserResult) continue;
        winnerResult.points += model.winPoints;
        loserResult.points += model.lossPoints;
        addLabel(winnerId, `v mot ${competitorNamesById.get(loserId) ?? loserId}${margin ? ` ${margin}` : ""}`);
        addLabel(loserId, `f mot ${competitorNamesById.get(winnerId) ?? winnerId}${margin ? ` ${margin}` : ""}`);
      }

      return results.map((result) => ({
        ...result,
        scoreLabel: (labelsByCompetitorId.get(result.competitorId) ?? []).join(", "),
      }));
    }

    if (usesScoreComparedTeamMatchResults(round, model, format)) {
      return nextConfig.results[resultKey] ?? [];
    }

    if (!usesTeamPoolForMatchRound(round, nextConfig.teams.length)) return nextConfig.results[resultKey] ?? [];

    const playerNamesById = new Map(nextConfig.players.map((player) => [player.id, player.name]));
    const segments = matchSegmentsForResultKey(round, resultKey);
    const existing = new Map((nextConfig.results[resultKey] ?? []).map((result) => [result.competitorId, result]));
    const results = competitorsForRound(nextConfig, round).map((competitor) => ({
      ...createResult(competitor.id),
      ...existing.get(competitor.id),
      competitorId: competitor.id,
      scoreLabel: "",
      rawScore: null,
      playerScores: {},
      points: 0,
      winnerOverride: false,
    }));
    const resultsByCompetitorId = new Map(results.map((result) => [result.competitorId, result]));
    const labelsByCompetitorId = new Map<string, string[]>();
    const addLabel = (competitorId: string, label: string) => {
      if (!label) return;
      labelsByCompetitorId.set(competitorId, [...(labelsByCompetitorId.get(competitorId) ?? []), label]);
    };

    for (const item of round.schedule) {
      for (const rawPairing of item.pairings ?? []) {
        const pairing = normalizePairingResult(rawPairing);
        if (!segments.has(pairing.segment)) continue;

        const [playerAId, playerBId] = pairing.playerIds;
        if (!playerAId || !playerBId) continue;

        const playerAResult = resultsByCompetitorId.get(playerAId);
        const playerBResult = resultsByCompetitorId.get(playerBId);
        if (!playerAResult || !playerBResult) continue;

        const playerAName = firstName(playerNamesById.get(playerAId) ?? playerAId);
        const playerBName = firstName(playerNamesById.get(playerBId) ?? playerBId);
        const margin = matchMarginLabel(pairing);

        if (pairing.halved) {
          playerAResult.points += model.drawPoints;
          playerBResult.points += model.drawPoints;
          addLabel(playerAId, `delad mot ${playerBName}`);
          addLabel(playerBId, `delad mot ${playerAName}`);
          continue;
        }

        if (pairing.winnerId !== playerAId && pairing.winnerId !== playerBId) continue;

        const winnerId = pairing.winnerId;
        const loserId = winnerId === playerAId ? playerBId : playerAId;
        const winnerResult = resultsByCompetitorId.get(winnerId);
        const loserResult = resultsByCompetitorId.get(loserId);
        if (!winnerResult || !loserResult) continue;

        winnerResult.points += model.winPoints;
        loserResult.points += model.lossPoints;

        const winnerName = winnerId === playerAId ? playerAName : playerBName;
        const loserName = loserId === playerAId ? playerAName : playerBName;
        addLabel(winnerId, `v mot ${loserName}${margin ? ` ${margin}` : ""}`);
        addLabel(loserId, `f mot ${winnerName}${margin ? ` ${margin}` : ""}`);
      }
    }

    return results.map((result) => ({
      ...result,
      scoreLabel: (labelsByCompetitorId.get(result.competitorId) ?? []).join(", "),
    }));
  }

  function movePlayerToTeam(playerId: string, targetTeamId: string) {
    if (locked) return;
    patchConfig((prev) => ({
      ...prev,
      teams: prev.teams.map((team) => {
        const withoutPlayer = team.memberIds.filter((id) => id !== playerId);
        if (!targetTeamId || team.id !== targetTeamId) return { ...team, memberIds: withoutPlayer };
        return { ...team, memberIds: [...withoutPlayer, playerId] };
      }),
    }));
  }

  function movePlayerWithinTeam(teamId: string, playerId: string, direction: -1 | 1) {
    if (locked) return;
    patchConfig((prev) => ({
      ...prev,
      teams: prev.teams.map((team) => {
        if (team.id !== teamId) return team;
        const currentIndex = team.memberIds.indexOf(playerId);
        const nextIndex = currentIndex + direction;
        if (currentIndex < 0 || nextIndex < 0 || nextIndex >= team.memberIds.length) return team;

        const memberIds = team.memberIds.slice();
        const [moved] = memberIds.splice(currentIndex, 1);
        memberIds.splice(nextIndex, 0, moved);
        return { ...team, memberIds };
      }),
    }));
  }

  function addRound(format = "stableford") {
    if (locked) return;
    const round = createRound(format as OtherCompetitionRound["format"], config.rounds.length);
    patchConfig((prev) => ({
      ...prev,
      rounds: [...prev.rounds, round],
      results: { ...prev.results, [round.id]: [] },
    }));
    setSelectedRoundId(round.id);
    setSelectedResultKey(round.id);
  }

  function patchRound(roundId: string, patch: Partial<OtherCompetitionRound>) {
    patchConfig((prev) => {
      const rounds = prev.rounds.map((round) => {
        if (round.id !== roundId) return round;
        const nextRound = {
          ...round,
          ...patch,
          schedule: Array.isArray(patch.schedule) ? patch.schedule.map(normalizeScheduleItemPairings) : round.schedule,
        };
        return nextRound;
      });
      const nextRound = rounds.find((round) => round.id === roundId);
      const results = { ...prev.results };

      if (nextRound && usesTeamPoolForMatchRound(nextRound, prev.teams.length)) {
        const nextConfig = { ...prev, rounds, results };
        for (const unit of scoringUnitsForRound(nextRound)) {
          results[unit.resultKey] = deriveMatchResultsForResultKey(nextConfig, nextRound, unit.resultKey);
        }
      }

      return {
        ...prev,
        rounds,
        results,
      };
    });
  }

  function removeRound(roundId: string) {
    if (locked) return;
    patchConfig((prev) => {
      const nextResults = { ...prev.results };
      delete nextResults[roundId];
      const round = prev.rounds.find((item) => item.id === roundId);
      for (const part of round?.parts ?? []) {
        delete nextResults[`${roundId}:${part.id}`];
      }
      return {
        ...prev,
        rounds: prev.rounds.filter((round) => round.id !== roundId),
        results: nextResults,
      };
    });
    setSelectedRoundId("");
    setSelectedResultKey("");
  }

  function splitRoundIntoNines(round: OtherCompetitionRound) {
    if (isRoundLocked(round)) return;
    const parts = [
      {
        id: crypto.randomUUID(),
        name: "Hål 1-9",
        format: "greensome" as const,
        customFormatName: "",
        holes: 9,
        scoringModel: { ...round.scoringModel, placementPoints: [...round.scoringModel.placementPoints] },
        sortOrder: 0,
      },
      {
        id: crypto.randomUUID(),
        name: "Hål 10-18",
        format: "best_ball" as const,
        customFormatName: "",
        holes: 9,
        scoringModel: { ...round.scoringModel, placementPoints: [...round.scoringModel.placementPoints] },
        sortOrder: 1,
      },
    ];

    patchRound(round.id, { holes: 18, parts });
    setSelectedResultKey(`${round.id}:${parts[0].id}`);
  }

  function addRoundPart(round: OtherCompetitionRound) {
    if (isRoundLocked(round)) return;
    const part = {
      id: crypto.randomUUID(),
      name: `Del ${(round.parts ?? []).length + 1}`,
      format: round.format,
      customFormatName: "",
      holes: 9,
      scoringModel: { ...round.scoringModel, placementPoints: [...round.scoringModel.placementPoints] },
      sortOrder: (round.parts ?? []).length,
    };
    patchRound(round.id, { parts: [...(round.parts ?? []), part] });
    setSelectedResultKey(`${round.id}:${part.id}`);
  }

  function patchRoundPart(round: OtherCompetitionRound, partId: string, patch: Partial<NonNullable<OtherCompetitionRound["parts"]>[number]>) {
    patchRound(round.id, {
      parts: (round.parts ?? []).map((part) => (part.id === partId ? { ...part, ...patch } : part)),
    });
  }

  function removeRoundPart(round: OtherCompetitionRound, partId: string) {
    if (isRoundLocked(round)) return;
    patchConfig((prev) => {
      const nextResults = { ...prev.results };
      delete nextResults[`${round.id}:${partId}`];
      return {
        ...prev,
        rounds: prev.rounds.map((item) =>
          item.id === round.id ? { ...item, parts: (item.parts ?? []).filter((part) => part.id !== partId) } : item
        ),
        results: nextResults,
      };
    });
    if (selectedResultKey === `${round.id}:${partId}`) setSelectedResultKey(round.id);
  }

  function ensureUnitResults(unit: NonNullable<typeof selectedScoringUnit>) {
    const competitors = competitorsForRound(config, unit.round);
    const existing = new Map((config.results[unit.resultKey] ?? []).map((result) => [result.competitorId, result]));
    return competitors.map((competitor) => existing.get(competitor.id) ?? createResult(competitor.id));
  }

  function patchRoundResults(roundId: string, results: OtherCompetitionResult[]) {
    patchConfig((prev) => ({
      ...prev,
      results: { ...prev.results, [roundId]: results },
    }));
  }

  function rankingScore(result: OtherCompetitionResult) {
    if (typeof result.rawScore === "number" && Number.isFinite(result.rawScore)) return result.rawScore;
    const values = Object.values(result.playerScores ?? {}).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0);
  }

  function comparableRankingScore(unit: NonNullable<typeof selectedScoringUnit>, result: OtherCompetitionResult) {
    const score = rankingScore(result);
    if (score === null) return null;
    const metric = scoringModelForUnit(unit).placementMetric ?? defaultPlacementMetricForFormat(unitFormat(unit));
    return metric === "strokes" ? -score : score;
  }

  function applyPlacementPointsToResults(unit: NonNullable<typeof selectedScoringUnit>, results: OtherCompetitionResult[]) {
    if (scoringModelForUnit(unit).kind !== "placement") return results;

    const competitors = new Map(competitorsForRound(config, unit.round).map((competitor) => [competitor.id, competitor]));
    const scoredRows = results
      .map((result) => ({ result, score: comparableRankingScore(unit, result) }))
      .filter((row): row is { result: OtherCompetitionResult; score: number } => row.score !== null);
    const topScore = scoredRows.length > 1 ? Math.max(...scoredRows.map((row) => row.score)) : null;
    const playoffIds =
      topScore == null
        ? new Set<string>()
        : new Set(scoredRows.filter((row) => row.score === topScore).map((row) => row.result.competitorId));
    const cleanedResults =
      playoffIds.size > 1
        ? results.map((result) => (playoffIds.has(result.competitorId) ? result : { ...result, winnerOverride: false }))
        : results.map((result) => ({ ...result, winnerOverride: false }));
    const ranked = rankEntries(
      cleanedResults
        .map((result) => ({ result, score: comparableRankingScore(unit, result) }))
        .filter((row): row is { result: OtherCompetitionResult; score: number } => row.score !== null)
        .map(({ result, score }) => ({
          competitor: competitors.get(result.competitorId) ?? {
            id: result.competitorId,
            type: "player" as const,
            name: result.competitorId,
            avatarUrl: null,
            memberNames: [],
            teamId: null,
            teamName: null,
            teamColor: null,
            teamIcon: null,
          },
          points: score,
          result,
        }))
    );
    const distribution = scoringModelForUnit(unit).placementPoints;
    const byId = new Map(ranked.map((row) => [row.competitor.id, distribution[(row.placement ?? 0) - 1] ?? 0]));

    return cleanedResults.map((result) => ({
      ...result,
      points: byId.get(result.competitorId) ?? 0,
      adjustment: 0,
      bonus: 0,
    }));
  }

  function patchUnitResult(unit: NonNullable<typeof selectedScoringUnit>, competitorId: string, patch: Partial<OtherCompetitionResult>) {
    if (isRoundLocked(unit.round)) return;
    const results = ensureUnitResults(unit).map((result) =>
      result.competitorId === competitorId ? { ...result, ...patch } : result
    );
    patchRoundResults(unit.resultKey, applyPlacementPointsToResults(unit, results));
  }

  function patchPlayerScore(unit: NonNullable<typeof selectedScoringUnit>, teamId: string, playerId: string, value: string) {
    if (isRoundLocked(unit.round)) return;
    const numericValue = value === "" ? null : Number(value);
    const members = teamMembers(teamId);
    const results = ensureUnitResults(unit).map((result) => {
      if (result.competitorId !== teamId) return result;
      const playerScores = {
        ...(result.playerScores ?? {}),
        [playerId]: numericValue != null && Number.isFinite(numericValue) ? numericValue : null,
      };
      const entered = members
        .map((member) => ({ member, value: playerScores[member.id] }))
        .filter((row): row is { member: OtherCompetitionPlayer; value: number } => typeof row.value === "number" && Number.isFinite(row.value));
      const total = entered.reduce((sum, row) => sum + row.value, 0);
      const suffix = unitFormat(unit) === "stableford" ? "p" : "";
      return {
        ...result,
        playerScores,
        rawScore: entered.length > 0 ? total : null,
        scoreLabel:
          entered.length > 0
            ? `${entered.map((row) => `${firstName(row.member.name)} ${row.value}${suffix}`).join(" + ")} = ${total}${suffix}`
            : "",
      };
    });
    patchRoundResults(unit.resultKey, applyPlacementPointsToResults(unit, results));
  }

  function scoreComparedResultText(value: number | null, format: OtherCompetitionRound["format"], model: OtherCompetitionScoringModel) {
    if (value == null || !Number.isFinite(value)) return "";
    const suffix = resolvedResultDisplay(format, model) === "points" ? "p" : "";
    return `${fmtPoints(value)}${suffix}`;
  }

  function scoreComparedMatchupLabel(
    teamALabel: string,
    teamBLabel: string,
    teamAScore: number | null,
    teamBScore: number | null,
    format: OtherCompetitionRound["format"],
    model: OtherCompetitionScoringModel
  ) {
    const scoreA = scoreComparedResultText(teamAScore, format, model);
    const scoreB = scoreComparedResultText(teamBScore, format, model);
    if (!scoreA && !scoreB) return "";
    if (!scoreA) return `${teamBLabel} ${scoreB}`;
    if (!scoreB) return `${teamALabel} ${scoreA}`;
    return `${teamALabel} ${scoreA} - ${teamBLabel} ${scoreB}`;
  }

  function patchScoreComparedTeamResult(
    unit: NonNullable<typeof selectedScoringUnit>,
    item: OtherCompetitionScheduleItem,
    competitorId: string,
    value: string
  ) {
    if (isRoundLocked(unit.round)) return;
    const model = scoringModelForUnit(unit);
    const format = unitFormat(unit);
    const numericValue = value === "" ? null : Number(value);
    const nextRawValue = numericValue != null && Number.isFinite(numericValue) ? numericValue : null;
    const [teamAId, teamBId] = item.competitorIds;
    const teamNamesById = new Map(competitorsForRound(config, unit.round).map((competitor) => [competitor.id, competitor.name]));
    const initialResults = ensureUnitResults(unit).map((result) =>
      result.competitorId === competitorId
        ? {
            ...result,
            rawScore: nextRawValue,
            scoreLabel: scoreComparedResultText(nextRawValue, format, model),
            playerScores: {},
            adjustment: 0,
            bonus: 0,
            winnerOverride: false,
          }
        : result
    );
    const byId = new Map(initialResults.map((result) => [result.competitorId, result]));
    const teamAResult = byId.get(teamAId);
    const teamBResult = byId.get(teamBId);
    const teamAScore = typeof teamAResult?.rawScore === "number" && Number.isFinite(teamAResult.rawScore) ? teamAResult.rawScore : null;
    const teamBScore = typeof teamBResult?.rawScore === "number" && Number.isFinite(teamBResult.rawScore) ? teamBResult.rawScore : null;

    if (teamAResult) {
      teamAResult.scoreLabel = scoreComparedResultText(teamAScore, format, model);
      teamAResult.points =
        teamAScore == null || teamBScore == null
          ? 0
          : teamAScore === teamBScore
          ? model.drawPoints
          : teamAScore > teamBScore
          ? model.winPoints
          : model.lossPoints;
    }
    if (teamBResult) {
      teamBResult.scoreLabel = scoreComparedResultText(teamBScore, format, model);
      teamBResult.points =
        teamAScore == null || teamBScore == null
          ? 0
          : teamAScore === teamBScore
          ? model.drawPoints
          : teamBScore > teamAScore
          ? model.winPoints
          : model.lossPoints;
    }

    const results = initialResults.map((result) => ({
      ...result,
      note:
        result.competitorId === teamAId || result.competitorId === teamBId
          ? scoreComparedMatchupLabel(
              teamNamesById.get(teamAId) ?? teamAId,
              teamNamesById.get(teamBId) ?? teamBId,
              teamAScore,
              teamBScore,
              format,
              model
            )
          : result.note,
    }));

    patchRoundResults(unit.resultKey, results);
  }

  function firstPlaceTieIds(unit: NonNullable<typeof selectedScoringUnit>, results: OtherCompetitionResult[]) {
    const scored = results
      .map((result) => ({ id: result.competitorId, score: comparableRankingScore(unit, result) }))
      .filter((row): row is { id: string; score: number } => row.score !== null);
    if (scored.length < 2) return new Set<string>();
    const topScore = Math.max(...scored.map((row) => row.score));
    const tied = scored.filter((row) => row.score === topScore).map((row) => row.id);
    return new Set(tied.length > 1 && scoringModelForUnit(unit).kind === "placement" ? tied : []);
  }

  function setPlayoffWinner(unit: NonNullable<typeof selectedScoringUnit>, competitorId: string, checked: boolean) {
    if (isRoundLocked(unit.round)) return;
    const results = ensureUnitResults(unit).map((result) => ({
      ...result,
      winnerOverride: checked ? result.competitorId === competitorId : false,
      placementOverride: null,
    }));
    patchRoundResults(unit.resultKey, applyPlacementPointsToResults(unit, results));
  }

  function addScheduleItem(round: OtherCompetitionRound) {
    if (isRoundLocked(round)) return;
    const itemLabel = isMatchRound(round) ? "Match" : "Boll";
    const item: OtherCompetitionScheduleItem = {
      id: crypto.randomUUID(),
      time: "",
      title: `${itemLabel} ${round.schedule.length + 1}`,
      competitorIds: [],
      pairings: [],
      matchWinnerCompetitorId: null,
      matchHalved: false,
      matchPoints: null,
      holesRemaining: null,
      matchResultLabel: "",
      unitMatchResults: {},
      note: "",
    };
    patchRound(round.id, { schedule: [...round.schedule, item] });
  }

  function defaultMatchPairings(round: OtherCompetitionRound, competitorIds: string[]) {
    const pairings: OtherCompetitionSchedulePairing[] = [];
    const includeBackNine = matchPairingSegments(round).length > 1;

    if (competitorIds.every((id) => config.teams.some((team) => team.id === id))) {
      for (let index = 0; index < competitorIds.length; index += 2) {
        const teamA = config.teams.find((team) => team.id === competitorIds[index]);
        const teamB = config.teams.find((team) => team.id === competitorIds[index + 1]);
        if (!teamA || !teamB) continue;
        const [a1, a2] = teamA.memberIds;
        const [b1, b2] = teamB.memberIds;
        if (a1 && b1) {
          pairings.push({ id: crypto.randomUUID(), segment: "front_9", playerIds: [a1, b1], resultLabel: "", winnerId: null, halved: false, matchPoints: null, holesRemaining: null });
        }
        if (a2 && b2) {
          pairings.push({ id: crypto.randomUUID(), segment: "front_9", playerIds: [a2, b2], resultLabel: "", winnerId: null, halved: false, matchPoints: null, holesRemaining: null });
        }
        if (includeBackNine) {
          if (a1 && b2) {
            pairings.push({ id: crypto.randomUUID(), segment: "back_9", playerIds: [a1, b2], resultLabel: "", winnerId: null, halved: false, matchPoints: null, holesRemaining: null });
          }
          if (a2 && b1) {
            pairings.push({ id: crypto.randomUUID(), segment: "back_9", playerIds: [a2, b1], resultLabel: "", winnerId: null, halved: false, matchPoints: null, holesRemaining: null });
          }
        }
      }
      return pairings;
    }

    for (let index = 0; index < competitorIds.length; index += 4) {
      const group = competitorIds.slice(index, index + 4);
      if (group.length < 2) continue;
      pairings.push({
        id: crypto.randomUUID(),
        segment: "front_9",
        playerIds: group.slice(0, 2),
        resultLabel: "",
        winnerId: null,
        halved: false,
        matchPoints: null,
        holesRemaining: null,
      });
      if (group.length >= 4) {
        pairings.push({
          id: crypto.randomUUID(),
          segment: "front_9",
          playerIds: group.slice(2, 4),
          resultLabel: "",
          winnerId: null,
          halved: false,
          matchPoints: null,
          holesRemaining: null,
        });
        if (includeBackNine) {
          pairings.push({
            id: crypto.randomUUID(),
            segment: "back_9",
            playerIds: [group[0], group[2]],
            resultLabel: "",
            winnerId: null,
            halved: false,
            matchPoints: null,
            holesRemaining: null,
          });
          pairings.push({
            id: crypto.randomUUID(),
            segment: "back_9",
            playerIds: [group[1], group[3]],
            resultLabel: "",
            winnerId: null,
            halved: false,
            matchPoints: null,
            holesRemaining: null,
          });
        }
      }
    }
    return pairings;
  }

  function generateSchedule(round: OtherCompetitionRound) {
    if (isRoundLocked(round)) return;
    const competitors = scheduleCompetitorsForRound(round);
    const defaultPerBall = usesTeamPoolForMatchRound(round, config.teams.length) || usesAnyTeamMatchMode(round) ? 2 : 4;
    const ballsCount = round.ballsCount > 0 ? round.ballsCount : Math.ceil(competitors.length / defaultPerBall);
    const perBall = Math.max(1, Math.ceil(competitors.length / Math.max(1, ballsCount)));
    const schedule: OtherCompetitionScheduleItem[] = [];

    for (let i = 0; i < competitors.length; i += perBall) {
      const itemLabel = isMatchRound(round) ? "Match" : "Boll";
      schedule.push({
        id: crypto.randomUUID(),
        time: "",
        title: `${itemLabel} ${schedule.length + 1}`,
        competitorIds: competitors.slice(i, i + perBall).map((competitor) => competitor.id),
        pairings:
          usesTeamPoolForMatchRound(round, config.teams.length)
            ? defaultMatchPairings(round, competitors.slice(i, i + perBall).map((competitor) => competitor.id))
            : [],
        matchWinnerCompetitorId: null,
        matchHalved: false,
        matchPoints: null,
        holesRemaining: null,
        matchResultLabel: "",
        unitMatchResults: {},
        note: "",
      });
    }

    patchRound(round.id, { schedule, ballsCount });
  }

  function patchScheduleItem(round: OtherCompetitionRound, itemId: string, patch: Partial<OtherCompetitionScheduleItem>) {
    patchRound(round.id, {
      schedule: round.schedule.map((item) => (item.id === itemId ? normalizeScheduleItemPairings({ ...item, ...patch }) : item)),
    });
  }

  function patchScheduleItemMatchResult(
    round: OtherCompetitionRound,
    resultKey: string,
    itemId: string,
    patch: Partial<OtherCompetitionScheduleItemMatchResult>
  ) {
    patchRound(round.id, {
      schedule: round.schedule.map((item) => {
        if (item.id !== itemId) return item;
        const unitMatchResults = {
          ...(item.unitMatchResults ?? {}),
          [resultKey]: {
            ...(item.unitMatchResults?.[resultKey] ?? {}),
            ...patch,
          },
        };
        return normalizeScheduleItemPairings({ ...item, unitMatchResults });
      }),
    });
  }

  function addSchedulePairing(round: OtherCompetitionRound, item: OtherCompetitionScheduleItem, segment: OtherCompetitionSchedulePairing["segment"]) {
    patchScheduleItem(round, item.id, {
      pairings: [
        ...(item.pairings ?? []),
        {
          id: crypto.randomUUID(),
          segment,
          playerIds: item.competitorIds.slice(0, 2),
          resultLabel: "",
          winnerId: null,
          halved: false,
          matchPoints: null,
          holesRemaining: null,
        },
      ],
    });
  }

  function patchSchedulePairing(
    round: OtherCompetitionRound,
    item: OtherCompetitionScheduleItem,
    pairingId: string,
    patch: Partial<OtherCompetitionSchedulePairing>
  ) {
    patchScheduleItem(round, item.id, {
      pairings: (item.pairings ?? []).map((pairing) =>
        pairing.id === pairingId ? normalizePairingResult({ ...pairing, ...patch }) : pairing
      ),
    });
  }

  function removeSchedulePairing(round: OtherCompetitionRound, item: OtherCompetitionScheduleItem, pairingId: string) {
    patchScheduleItem(round, item.id, {
      pairings: (item.pairings ?? []).filter((pairing) => pairing.id !== pairingId),
    });
  }

  function removeScheduleItem(round: OtherCompetitionRound, itemId: string) {
    patchRound(round.id, { schedule: round.schedule.filter((item) => item.id !== itemId) });
  }

  function scheduledCompetitorIds(round: OtherCompetitionRound, exceptItemId?: string) {
    return new Set(
      round.schedule
        .filter((item) => item.id !== exceptItemId)
        .flatMap((item) => item.competitorIds)
    );
  }

  function moveCompetitorToScheduleItem(round: OtherCompetitionRound, itemId: string, competitorId: string) {
    if (isRoundLocked(round)) return;
    patchRound(round.id, {
      schedule: round.schedule.map((item) => {
        const withoutCompetitor = item.competitorIds.filter((id) => id !== competitorId);
        if (item.id !== itemId) return { ...item, competitorIds: withoutCompetitor };
        if (item.competitorIds.includes(competitorId)) return item;
        const competitorIds = [...item.competitorIds, competitorId];
        return {
          ...item,
          competitorIds,
          pairings: usesTeamPoolForMatchRound(round, config.teams.length) ? defaultMatchPairings(round, competitorIds) : item.pairings,
        };
      }),
    });
  }

  function removeCompetitorFromScheduleItem(round: OtherCompetitionRound, itemId: string, competitorId: string) {
    if (isRoundLocked(round)) return;
    patchRound(round.id, {
      schedule: round.schedule.map((item) =>
        item.id === itemId
          ? {
              ...item,
              competitorIds: item.competitorIds.filter((id) => id !== competitorId),
              pairings:
                usesTeamPoolForMatchRound(round, config.teams.length)
                  ? defaultMatchPairings(round, item.competitorIds.filter((id) => id !== competitorId))
                  : item.pairings,
            }
          : item
      ),
    });
  }

  const saveTone =
    saveState === "error"
      ? "text-red-200"
      : saveState === "saving"
        ? "text-amber-100"
        : saveState === "saved"
          ? "text-emerald-100"
          : "text-white/58";
  const selectedRoundLocked = selectedScoringUnit ? isRoundLocked(selectedScoringUnit.round) : locked;

  return (
    <main className="space-y-5">
      <section className="rounded-[30px] border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.16)] md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.28em] text-white/45">Andra tävlingar</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{competition.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75">
                {statusLabel(competition.status)}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs ${saveTone}`}>
                {saveState === "saving" ? "Sparar..." : saveMessage || "Autosave aktiv"}
              </span>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[360px]">
            {competition.status === "locked" ? null : competition.status === "draft" ? (
              <button type="button" onClick={() => setStatus("published")} className={buttonClass("primary")}>
                Publicera
              </button>
            ) : (
              <button type="button" onClick={() => setStatus("draft")} className={buttonClass()}>
                Avpublicera
              </button>
            )}
            {competition.status !== "live" && competition.status !== "locked" ? (
              <button type="button" onClick={() => setStatus("live")} className={buttonClass("primary")}>
                Sätt Pågår
              </button>
            ) : null}
            {competition.status !== "locked" ? (
              <button type="button" onClick={() => setStatus("locked")} className={buttonClass("success")}>
                Lås/slutför
              </button>
            ) : (
              <button type="button" onClick={() => setStatus("published")} className={buttonClass("danger")}>
                Lås upp
              </button>
            )}
            <button type="button" onClick={() => void saveNow()} disabled={locked} className={buttonClass()}>
              Spara nu
            </button>
          </div>
        </div>

        {locked ? (
          <div className="mt-4 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            Tävlingen är låst och skrivskyddad. Lås upp den för att ändra historik.
          </div>
        ) : null}
      </section>

      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={[
              "h-10 shrink-0 rounded-xl border px-4 text-sm font-medium transition",
              tab === item ? "border-white/25 bg-white/12 text-white" : "border-white/10 bg-white/5 text-white/70",
            ].join(" ")}
          >
            {tabLabel(item)}
          </button>
        ))}
      </nav>

      {tab === "basic" ? (
        <section className="grid gap-4 rounded-[26px] border border-white/10 bg-white/[0.04] p-4 md:grid-cols-2 md:p-5">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-white/45">Namn</span>
            <input disabled={locked} value={competition.name} onChange={(e) => patchCompetition({ name: e.target.value })} className={inputClass(locked)} />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-white/45">Slug</span>
            <input
              disabled={locked}
              value={competition.slug}
              onChange={(e) => patchCompetition({ slug: normalizeSlug(e.target.value) })}
              className={inputClass(locked)}
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-white/45">Startdatum</span>
            <input disabled={locked} type="date" value={competition.starts_on} onChange={(e) => patchCompetition({ starts_on: e.target.value })} className={inputClass(locked)} />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-white/45">Slutdatum</span>
            <input disabled={locked} type="date" value={competition.ends_on} onChange={(e) => patchCompetition({ ends_on: e.target.value })} className={inputClass(locked)} />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-xs uppercase tracking-[0.2em] text-white/45">Plats/undertitel</span>
            <input disabled={locked} value={competition.location} onChange={(e) => patchCompetition({ location: e.target.value })} className={inputClass(locked)} />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-xs uppercase tracking-[0.2em] text-white/45">Korttext</span>
            <textarea disabled={locked} value={competition.subtitle} onChange={(e) => patchCompetition({ subtitle: e.target.value })} className={`${inputClass(locked)} min-h-28`} />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-white/45">Kortbild URL</span>
            <input disabled={locked} value={competition.card_image_url} onChange={(e) => patchCompetition({ card_image_url: e.target.value })} className={inputClass(locked)} />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-white/45">Headerbild URL</span>
            <input disabled={locked} value={competition.header_image_url} onChange={(e) => patchCompetition({ header_image_url: e.target.value })} className={inputClass(locked)} />
          </label>
        </section>
      ) : null}

      {tab === "players" ? (
        <section className="space-y-4">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
              <select disabled={locked} value={selectedPersonId} onChange={(e) => setSelectedPersonId(e.target.value)} className={inputClass(locked)}>
                <option value="">Välj PostNord-spelare att importera</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
              <button type="button" disabled={locked || !selectedPersonId} onClick={importPerson} className={buttonClass("primary")}>
                Importera snapshot
              </button>
              <button type="button" disabled={locked} onClick={addExternalPlayer} className={buttonClass()}>
                Lägg till extern
              </button>
            </div>
          </div>
          <div className="grid gap-3">
            {sortedPlayers(config.players).map((player) => {
              const team = playerTeam(player.id);
              return (
                <div key={player.id} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_auto]">
                    <input disabled={locked} value={player.name} onChange={(e) => patchPlayer(player.id, { name: e.target.value })} className={inputClass(locked)} />
                    <input disabled={locked} value={player.avatarUrl ?? ""} onChange={(e) => patchPlayer(player.id, { avatarUrl: e.target.value || null })} placeholder="Bild URL" className={inputClass(locked)} />
                    <input
                      disabled={locked}
                      type="number"
                      value={player.hcp ?? ""}
                      onChange={(e) => patchPlayer(player.id, { hcp: e.target.value === "" ? null : Number(e.target.value) })}
                      placeholder="HCP"
                      className={inputClass(locked)}
                    />
                    <button type="button" disabled={locked} onClick={() => removePlayer(player.id)} className={buttonClass("danger")}>
                      Ta bort
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/45">
                    <span>{player.sourceLabel === "postnord" ? "Importerad som snapshot från PostNord Cup" : "Extern spelare i denna modul"}</span>
                    {team ? (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-white/82"
                        style={{ backgroundColor: `${team.color}22`, borderColor: `${team.color}66` }}
                      >
                        <span aria-hidden>{team.icon ?? "◆"}</span>
                        <span>{team.name || teamDisplayName(team, config.players)}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {tab === "teams" ? (
        <section className="space-y-4">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <div className="grid gap-3 md:grid-cols-[160px_160px_auto_auto_auto_minmax(0,1fr)]">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-white/45">Antal spelare</span>
                <input
                  disabled={locked}
                  type="number"
                  min={1}
                  value={config.settings.plannedPlayerCount ?? (config.players.length || 12)}
                  onChange={(e) => patchConfig((prev) => ({ ...prev, settings: { ...prev.settings, plannedPlayerCount: Number(e.target.value) || 1 } }))}
                  className={inputClass(locked)}
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-white/45">Antal lag</span>
                <input
                  disabled={locked}
                  type="number"
                  min={1}
                  value={config.settings.plannedTeamCount ?? (config.teams.length || 6)}
                  onChange={(e) => patchConfig((prev) => ({ ...prev, settings: { ...prev.settings, plannedTeamCount: Number(e.target.value) || 1 } }))}
                  className={inputClass(locked)}
                />
              </label>
              <button type="button" disabled={locked} onClick={generateTeams} className={buttonClass("primary")}>
                Lägg till
              </button>
              <button type="button" disabled={locked} onClick={addTeam} className={buttonClass()}>
                Tomt lag
              </button>
              <button type="button" disabled={locked || config.teams.length === 0} onClick={clearTeams} className={buttonClass("danger")}>
                Rensa alla lag
              </button>
              <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4">
                <input
                  disabled={locked}
                  type="checkbox"
                  checked={config.settings.isTeamCompetition !== false}
                  onChange={(e) => patchConfig((prev) => ({ ...prev, settings: { ...prev.settings, isTeamCompetition: e.target.checked } }))}
                />
                <span className="text-sm text-white/80">Totalställning som lagtävling</span>
              </label>
            </div>
            <div className="mt-3 text-sm text-white/55">
              Exempel: 12 spelare och 6 lag skapar 6 tomma lag med 2 platser i varje. Spelarna ligger kvar i poolen tills du väljer in dem i ett lag.
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Spelarpool</h2>
                <div className="mt-1 text-sm text-white/55">Välj ett lag i listan för att flytta in spelaren direkt.</div>
              </div>
              <div className="text-sm text-white/50">
                {sortedPlayers(config.players).filter((player) => !playerTeamId(player.id)).length} st
              </div>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {sortedPlayers(config.players)
                .filter((player) => !playerTeamId(player.id))
                .map((player) => (
                  <div key={player.id} className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 sm:grid-cols-[minmax(0,1fr)_190px] sm:items-center">
                    <div className="min-w-0 font-medium">{player.name}</div>
                    <select
                      disabled={locked}
                      value=""
                      onChange={(e) => movePlayerToTeam(player.id, e.target.value)}
                      className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
                    >
                      <option value="">Flytta till lag...</option>
                      {sortedTeams(config.teams).map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name || teamDisplayName(team, config.players) || `Lag ${team.sortOrder + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              {sortedPlayers(config.players).filter((player) => !playerTeamId(player.id)).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-center text-sm text-white/52 md:col-span-2">
                  Alla importerade spelare ligger i lag. Flytta en spelare till “Utan lag” för att få tillbaka den här.
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3">
            {sortedTeams(config.teams).map((team) => (
              <div key={team.id} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-3 flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 text-lg font-semibold text-white"
                    style={{ backgroundColor: `${team.color}33`, borderColor: `${team.color}88` }}
                  >
                    {team.icon ?? "◆"}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold">{team.name || teamDisplayName(team, config.players) || `Lag ${team.sortOrder + 1}`}</div>
                    <div className="text-xs text-white/48">
                      {team.memberIds.length}/{teamTargetSize(team)} platser
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_90px_110px_130px_auto]">
                  <input disabled={locked} value={team.name} onChange={(e) => patchTeam(team.id, { name: e.target.value })} placeholder={teamDisplayName(team, config.players)} className={inputClass(locked)} />
                  <input disabled={locked} type="color" value={team.color} onChange={(e) => patchTeam(team.id, { color: e.target.value })} className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-2" />
                  <select disabled={locked} value={team.icon ?? "◆"} onChange={(e) => patchTeam(team.id, { icon: e.target.value })} className={inputClass(locked)}>
                    {TEAM_ICONS.map((icon) => (
                      <option key={icon} value={icon}>
                        {icon}
                      </option>
                    ))}
                  </select>
                  <input
                    disabled={locked}
                    type="number"
                    min={1}
                    value={teamTargetSize(team)}
                    onChange={(e) => patchTeam(team.id, { targetSize: Number(e.target.value) || 1 })}
                    className={inputClass(locked)}
                  />
                  <button type="button" disabled={locked} onClick={() => removeTeam(team.id)} className={buttonClass("danger")}>
                    Ta bort
                  </button>
                </div>
                <div className="mt-3 grid gap-2">
                  {team.memberIds
                    .map((playerId) => config.players.find((player) => player.id === playerId))
                    .filter((player): player is OtherCompetitionPlayer => Boolean(player))
                    .map((player, index) => (
                      <div key={player.id} className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 md:grid-cols-[minmax(0,1fr)_88px_190px] md:items-center">
                        <div className="min-w-0">
                          <div className="font-medium">{player.name}</div>
                          <div className="text-xs text-white/45">Plats {index + 1} i laget</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={locked || index === 0}
                            onClick={() => movePlayerWithinTeam(team.id, player.id, -1)}
                            className="min-h-10 rounded-xl border border-white/10 bg-white/5 text-sm disabled:opacity-35"
                            aria-label="Flytta upp"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={locked || index === team.memberIds.length - 1}
                            onClick={() => movePlayerWithinTeam(team.id, player.id, 1)}
                            className="min-h-10 rounded-xl border border-white/10 bg-white/5 text-sm disabled:opacity-35"
                            aria-label="Flytta ned"
                          >
                            ↓
                          </button>
                        </div>
                        <select
                          disabled={locked}
                          value={team.id}
                          onChange={(e) => movePlayerToTeam(player.id, e.target.value)}
                          className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
                        >
                          <option value="">Utan lag</option>
                          {sortedTeams(config.teams).map((targetTeam) => (
                            <option key={targetTeam.id} value={targetTeam.id}>
                              {targetTeam.name || teamDisplayName(targetTeam, config.players) || `Lag ${targetTeam.sortOrder + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  {team.memberIds.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-center text-sm text-white/52">
                      Inga spelare i laget ännu.
                    </div>
                  ) : null}
                  {Array.from({ length: Math.max(0, teamTargetSize(team) - team.memberIds.length) }).map((_, slotIndex) => (
                    <div
                      key={`${team.id}-slot-${slotIndex}`}
                      className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-3 text-sm text-white/42"
                    >
                      Tom plats {team.memberIds.length + slotIndex + 1}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "schedule" ? (
        <section className="space-y-4">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <select id="new-round-format" disabled={locked} className={inputClass(locked)} defaultValue="stableford">
                {FORMAT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={locked}
                onClick={() => {
                  const select = document.getElementById("new-round-format") as HTMLSelectElement | null;
                  addRound(select?.value ?? "stableford");
                }}
                className={buttonClass("primary")}
              >
                Lägg till speldag
              </button>
            </div>
          </div>

          {rounds.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 px-4 py-8 text-center text-white/60">
              Lägg till en speldag för att välja format, poängmodell, regler och schema.
            </div>
          ) : null}

          {rounds.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rounds.map((round) => {
                const parts = round.parts ?? [];
                const active = selectedRound?.id === round.id;
                return (
                  <button
                    key={round.id}
                    type="button"
                    onClick={() => {
                      setSelectedRoundId(round.id);
                      setSelectedResultKey(scoringUnitsForRound(round)[0]?.resultKey ?? round.id);
                    }}
                    className={[
                      "rounded-[22px] border p-4 text-left transition",
                      active
                        ? "border-sky-300/35 bg-sky-400/12"
                        : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-lg font-semibold">{round.name}</div>
                        <div className="mt-1 text-sm text-white/58">
                          {roundFormatSummary(round)}
                        </div>
                      </div>
                      <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs text-white/65">
                        {parts.length > 0 ? `${parts.length} delar` : `${round.holes} hål`}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-white/58">
                      <div className="rounded-xl border border-white/10 bg-black/20 px-2 py-2">
                        {round.playMode === "team" ? "Lag" : "Ind"}
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 px-2 py-2">
                        {round.schedule.length} schema
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 px-2 py-2">
                        {round.date || "Datum"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}

          {(selectedRound ? [selectedRound] : []).map((round) => {
            const competitors = scheduleCompetitorsForRound(round);
            const roundLocked = isRoundLocked(round);
            const usesTeamPool = usesTeamPoolForMatchRound(round, config.teams.length);
            const poolLabel = usesTeamPool ? "Lagpool" : "Spelarpool";
            const pairingSegments = matchPairingSegments(round);
            const hasRoundParts = (round.parts ?? []).length > 0;
            return (
              <div key={round.id} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{round.name}</h2>
                    <div className="mt-1 text-sm text-white/55">
                      {roundFormatSummary(round)} · {round.holes} hål ·{" "}
                      {round.playMode === "team" ? "Lag" : "Individuellt"}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => patchRound(round.id, { locked: !round.locked, lockedAt: round.locked ? null : new Date().toISOString() })}
                      className={round.locked ? buttonClass("danger") : buttonClass("success")}
                    >
                      {round.locked ? "Lås upp runda" : "Lås runda"}
                    </button>
                    <button type="button" disabled={roundLocked} onClick={() => removeRound(round.id)} className={buttonClass("danger")}>
                      Ta bort speldag
                    </button>
                  </div>
                </div>
                {round.locked ? (
                  <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-50">
                    Rundan är låst och skrivskyddad. Lås upp rundan för att ändra schema eller resultat.
                  </div>
                ) : null}

                <div className="mt-4 rounded-[20px] border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-white/45">1. Format och grundinställningar</div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-white/45">Namn</span>
                      <input disabled={roundLocked} value={round.name} onChange={(e) => patchRound(round.id, { name: e.target.value })} className={inputClass(roundLocked)} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-white/45">Datum</span>
                      <input disabled={roundLocked} type="date" value={round.date} onChange={(e) => patchRound(round.id, { date: e.target.value })} className={inputClass(roundLocked)} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-white/45">Tävlingsformat</span>
                      <select
                        disabled={roundLocked}
                        value={round.format}
                        onChange={(e) => {
                          const option = FORMAT_OPTIONS.find((item) => item.value === e.target.value);
                          patchRound(round.id, {
                            format: e.target.value as OtherCompetitionRound["format"],
                            playMode: option?.defaultMode ?? round.playMode,
                            scoringModel: defaultScoringModel(
                              e.target.value === "greensome" || e.target.value === "best_ball" ? "match" : option?.scoringKind ?? round.scoringModel.kind,
                              defaultPlacementMetricForFormat(e.target.value as OtherCompetitionRound["format"]),
                              defaultResultDisplayForFormat(e.target.value as OtherCompetitionRound["format"])
                            ),
                          });
                        }}
                        className={inputClass(roundLocked)}
                      >
                        {FORMAT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-white/45">Eget formatnamn</span>
                      <input disabled={roundLocked || round.format !== "custom"} value={round.customFormatName} onChange={(e) => patchRound(round.id, { customFormatName: e.target.value })} placeholder="Endast för custom" className={inputClass(roundLocked || round.format !== "custom")} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-white/45">Antal hål</span>
                      <input disabled={roundLocked} type="number" min={1} value={round.holes} onChange={(e) => patchRound(round.id, { holes: Number(e.target.value) || 18 })} className={inputClass(roundLocked)} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-white/45">Vem rankas i rundan?</span>
                      <select disabled={roundLocked} value={round.playMode} onChange={(e) => patchRound(round.id, { playMode: e.target.value as OtherCompetitionRound["playMode"] })} className={inputClass(roundLocked)}>
                        <option value="team">Lag - lagets resultat ger tabellpoäng</option>
                        <option value="individual">Spelare - individuella resultat ger tabellpoäng</option>
                      </select>
                      <span className="block text-xs leading-5 text-white/45">
                        Välj lag när två spelare samlar ett gemensamt lagresultat, till exempel ackumulerad poängbogey.
                      </span>
                    </label>
                  </div>
                </div>

                <div className="mt-4 rounded-[20px] border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-[0.22em] text-white/45">2. Delar inom rundan</div>
                      <div className="mt-1 text-sm text-white/55">
                        Dela en 18-hålsrunda i flera poängdelar, till exempel två separata 9-hålstävlingar.
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button type="button" disabled={roundLocked} onClick={() => splitRoundIntoNines(round)} className={buttonClass("primary")}>
                        Dela 18 i 2 x 9
                      </button>
                      <button type="button" disabled={roundLocked} onClick={() => addRoundPart(round)} className={buttonClass()}>
                        Lägg till del
                      </button>
                    </div>
                  </div>

                  {(round.parts ?? []).length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-4 py-5 text-center text-sm text-white/52">
                      Inga delar skapade. Resultat matas då in för hela rundan.
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-3">
                      {(round.parts ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder).map((part) => (
                        <div key={part.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_110px_auto]">
                            <input
                              disabled={roundLocked}
                              value={part.name}
                              onChange={(e) => patchRoundPart(round, part.id, { name: e.target.value })}
                              className={inputClass(roundLocked)}
                            />
                            <input
                              disabled={roundLocked}
                              type="number"
                              min={1}
                              value={part.holes}
                              onChange={(e) => patchRoundPart(round, part.id, { holes: Number(e.target.value) || 9 })}
                              className={inputClass(roundLocked)}
                            />
                            <button type="button" disabled={roundLocked} onClick={() => removeRoundPart(round, part.id)} className={buttonClass("danger")}>
                              Ta bort
                            </button>
                          </div>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <label className="space-y-2">
                              <span className="text-xs uppercase tracking-[0.18em] text-white/45">Format för denna del</span>
                              <select
                                disabled={roundLocked}
                                value={part.format ?? round.format}
                                onChange={(e) => {
                                  const option = FORMAT_OPTIONS.find((item) => item.value === e.target.value);
                                  patchRoundPart(round, part.id, {
                                    format: e.target.value as OtherCompetitionRound["format"],
                                    scoringModel: defaultScoringModel(
                                      e.target.value === "greensome" || e.target.value === "best_ball" ? "match" : option?.scoringKind ?? part.scoringModel.kind,
                                      defaultPlacementMetricForFormat(e.target.value as OtherCompetitionRound["format"]),
                                      defaultResultDisplayForFormat(e.target.value as OtherCompetitionRound["format"])
                                    ),
                                  });
                                }}
                                className={inputClass(roundLocked)}
                              >
                                {FORMAT_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="space-y-2">
                              <span className="text-xs uppercase tracking-[0.18em] text-white/45">Eget formatnamn</span>
                              <input
                                disabled={roundLocked || (part.format ?? round.format) !== "custom"}
                                value={part.customFormatName ?? ""}
                                onChange={(e) => patchRoundPart(round, part.id, { customFormatName: e.target.value })}
                                placeholder="Endast för custom"
                                className={inputClass(roundLocked || (part.format ?? round.format) !== "custom")}
                              />
                            </label>
                          </div>
                          <div className="mt-3">
                            <ScoringModelEditor
                              model={part.scoringModel}
                              format={part.format ?? round.format}
                              disabled={roundLocked}
                              onChange={(scoringModel) => patchRoundPart(round, part.id, { scoringModel })}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  className={[
                    "mt-4 rounded-[20px] p-4",
                    hasRoundParts ? "border border-white/10 bg-white/[0.03] opacity-60" : "border border-sky-300/15 bg-sky-400/10",
                  ].join(" ")}
                >
                  <div>
                    <div className={`text-xs uppercase tracking-[0.22em] ${hasRoundParts ? "text-white/45" : "text-sky-100/70"}`}>
                      3. Tabellpoäng och regler för hela rundan
                    </div>
                    <div className={`mt-1 text-sm ${hasRoundParts ? "text-white/55" : "text-sky-100/70"}`}>
                      {hasRoundParts
                        ? "Inaktiv när rundan är uppdelad i delar. Styr tabellpoäng och regler per del ovan."
                        : "Här styr du hur resultatet i rundan omvandlas till tävlingens tabellpoäng."}
                    </div>
                  </div>
                  <div className="mt-4">
                    <ScoringModelEditor
                      model={round.scoringModel}
                      format={round.format}
                      disabled={roundLocked || hasRoundParts}
                      onChange={(scoringModel) => patchRound(round.id, { scoringModel })}
                    />
                  </div>
                </div>

                <div className="mt-4 rounded-[20px] border border-white/10 bg-black/20 p-4">
                  {(() => {
                    const scheduledIds = scheduledCompetitorIds(round);
                    const pool = competitors.filter((competitor) => !scheduledIds.has(competitor.id));
                    return (
                      <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-white/45">{poolLabel}</div>
                            <div className="mt-1 text-sm text-white/55">Ej placerade i någon boll/match.</div>
                          </div>
                          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/65">
                            {pool.length} kvar
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {pool.map((competitor) => (
                            <span key={competitor.id} className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white/82">
                              {competitor.name}
                            </span>
                          ))}
                          {pool.length === 0 ? <span className="text-sm text-white/45">Alla är placerade.</span> : null}
                        </div>
                      </div>
                    );
                  })()}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-[0.22em] text-white/45">4. Spelschema</div>
                      <div className="mt-1 text-sm text-white/55">Bygg bollar, matcher eller vilande lag för denna speldag.</div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button type="button" disabled={roundLocked} onClick={() => generateSchedule(round)} className={buttonClass("primary")}>
                        Generera
                      </button>
                      <button type="button" disabled={roundLocked} onClick={() => addScheduleItem(round)} className={buttonClass()}>
                        Lägg till boll/match
                      </button>
                    </div>
                  </div>
                  <label className="mt-3 block space-y-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-white/45">Antal bollar/matcher</span>
                    <input disabled={roundLocked} type="number" min={0} value={round.ballsCount} onChange={(e) => patchRound(round.id, { ballsCount: Number(e.target.value) || 0 })} placeholder="Används av generatorn" className={inputClass(roundLocked)} />
                  </label>
                <div className="mt-4 grid gap-3">
                  {round.schedule.map((item) => (
                    <div key={item.id} className="rounded-[20px] border border-white/10 bg-black/20 p-3">
                      <div className="grid gap-3 md:grid-cols-[130px_minmax(0,1fr)_auto]">
                        <input disabled={roundLocked} value={item.time} onChange={(e) => patchScheduleItem(round, item.id, { time: e.target.value })} placeholder="Tid" className={inputClass(roundLocked)} />
                        <input disabled={roundLocked} value={item.title} onChange={(e) => patchScheduleItem(round, item.id, { title: e.target.value })} placeholder="Boll/match" className={inputClass(roundLocked)} />
                        <button type="button" disabled={roundLocked} onClick={() => removeScheduleItem(round, item.id)} className={buttonClass("danger")}>
                          Ta bort
                        </button>
                      </div>
                      {(() => {
                        const usedElsewhere = scheduledCompetitorIds(round, item.id);
                        const selected = competitors.filter((competitor) => item.competitorIds.includes(competitor.id));
                        const available = competitors.filter((competitor) => !item.competitorIds.includes(competitor.id) && !usedElsewhere.has(competitor.id));
                        return (
                          <div className="mt-3 grid gap-3">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                              <div className="text-xs uppercase tracking-[0.16em] text-white/42">I denna boll</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {selected.map((competitor) => (
                                  <button
                                    key={competitor.id}
                                    type="button"
                                    disabled={roundLocked}
                                    onClick={() => removeCompetitorFromScheduleItem(round, item.id, competitor.id)}
                                    className="rounded-full border border-sky-300/25 bg-sky-400/10 px-3 py-1.5 text-left text-sm font-medium text-sky-50 transition hover:bg-sky-400/18 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {competitor.name} <span className="text-sky-100/50">x</span>
                                  </button>
                                ))}
                                {selected.length === 0 ? <span className="text-sm text-white/45">Ingen vald ännu.</span> : null}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                              <div className="text-xs uppercase tracking-[0.16em] text-white/42">Lägg till från poolen</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {available.map((competitor) => (
                                  <button
                                    key={competitor.id}
                                    type="button"
                                    disabled={roundLocked}
                                    onClick={() => moveCompetitorToScheduleItem(round, item.id, competitor.id)}
                                    className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-left text-sm text-white/82 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    + {competitor.name}
                                  </button>
                                ))}
                                {available.length === 0 ? <span className="text-sm text-white/45">Inga lediga kvar.</span> : null}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      {usesTeamPool ? (
                        <div className="mt-3 rounded-2xl border border-sky-300/15 bg-sky-400/10 p-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="text-xs uppercase tracking-[0.18em] text-sky-100/70">
                                {pairingSegments.length > 1 ? "Parningar 9 + 9" : "Singelmatcher"}
                              </div>
                              <div className="mt-1 text-sm text-sky-100/65">
                                Välj två lag i bollen och ändra sedan vilka spelare som möter varandra.
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={roundLocked}
                              onClick={() => patchScheduleItem(round, item.id, { pairings: defaultMatchPairings(round, item.competitorIds) })}
                              className={buttonClass("primary")}
                            >
                              Föreslå parningar
                            </button>
                          </div>
                          {pairingSegments.map((segment) => (
                            <div key={segment} className="mt-3 grid gap-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold">
                                  {matchSegmentHeading(round, segment)}
                                </div>
                                <button type="button" disabled={roundLocked} onClick={() => addSchedulePairing(round, item, segment)} className={buttonClass()}>
                                  Lägg till match
                                </button>
                              </div>
                              {(item.pairings ?? []).filter((pairing) => pairing.segment === segment).map((pairing) => (
                                <div key={pairing.id} className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-2 md:grid-cols-[1fr_1fr_auto]">
                                  {[0, 1].map((playerIndex) => (
                                    <select
                                      key={playerIndex}
                                      disabled={roundLocked}
                                      value={pairing.playerIds[playerIndex] ?? ""}
                                      onChange={(e) => {
                                        const playerIds = pairing.playerIds.slice();
                                        playerIds[playerIndex] = e.target.value;
                                        patchSchedulePairing(round, item, pairing.id, {
                                          playerIds,
                                          winnerId: null,
                                          halved: false,
                                          matchPoints: null,
                                          holesRemaining: null,
                                          resultLabel: "",
                                        });
                                      }}
                                      className={inputClass(roundLocked)}
                                    >
                                      <option value="">Välj spelare</option>
                                      {pairingPlayersForItem(item).map((player) => {
                                        const team = playerTeam(player.id);
                                        return (
                                          <option key={player.id} value={player.id}>
                                            {firstName(player.name)}{team ? ` (${teamDisplayName(team, config.players)})` : ""}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  ))}
                                  <button type="button" disabled={roundLocked} onClick={() => removeSchedulePairing(round, item, pairing.id)} className={buttonClass("danger")}>
                                    Ta bort
                                  </button>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <textarea disabled={roundLocked} value={item.note} onChange={(e) => patchScheduleItem(round, item.id, { note: e.target.value })} placeholder="Notering" className={`${inputClass(roundLocked)} mt-3 min-h-20`} />
                    </div>
                  ))}
                  {round.schedule.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-center text-sm text-white/52">
                      Inget spelschema ännu. Använd generatorn eller lägg till en boll/match manuellt.
                    </div>
                  ) : null}
                </div>
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      {tab === "results" ? (
        <section className="space-y-4">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <select
              value={selectedScoringUnit?.resultKey ?? ""}
              onChange={(e) => {
                const unit = scoringUnits.find((item) => item.resultKey === e.target.value);
                setSelectedResultKey(e.target.value);
                if (unit) setSelectedRoundId(unit.round.id);
              }}
              className={inputClass(false)}
            >
              {scoringUnits.map((unit) => (
                <option key={unit.resultKey} value={unit.resultKey}>
                  {unit.part ? `${unit.round.name} - ${unit.label} (${partFormatLabel(unit.part, unit.round)})` : unit.round.name}
                </option>
              ))}
            </select>
          </div>

          {selectedScoringUnit ? (
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">
                    {selectedScoringUnit.part
                      ? `${selectedScoringUnit.round.name} - ${selectedScoringUnit.label}`
                      : selectedScoringUnit.round.name}
                  </h2>
                  <div className="text-sm text-white/55">
                    {selectedScoringUnit.part
                      ? partFormatLabel(selectedScoringUnit.part, selectedScoringUnit.round)
                      : formatLabel(selectedScoringUnit.round.format, selectedScoringUnit.round.customFormatName)} ·{" "}
                    {selectedScoringUnit.holes} hål · {scoringKindLabel(scoringModelForUnit(selectedScoringUnit).kind)}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() =>
                    patchRound(selectedScoringUnit.round.id, {
                      locked: !selectedScoringUnit.round.locked,
                      lockedAt: selectedScoringUnit.round.locked ? null : new Date().toISOString(),
                    })
                  }
                  className={selectedScoringUnit.round.locked ? buttonClass("danger") : buttonClass("success")}
                >
                  {selectedScoringUnit.round.locked ? "Lås upp runda" : "Lås runda"}
                </button>
              </div>
              {selectedScoringUnit.round.locked ? (
                <div className="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-50">
                  Rundan är låst. Lås upp den om resultat eller tabellpoäng behöver ändras.
                </div>
              ) : null}
              <div className="mt-3 rounded-2xl border border-sky-300/15 bg-sky-400/10 px-4 py-3 text-sm text-sky-100/80">
                {usesTeamPoolForMatchRound(selectedScoringUnit.round, config.teams.length)
                  ? "Matchresultat matas in här per singelmatch. Välj vinnare, segermarginal och hål kvar så uppdateras schemat och tabellpoängen räknas automatiskt."
                  : usesStructuredTeamMatchResults(selectedScoringUnit.round, scoringModelForUnit(selectedScoringUnit), unitFormat(selectedScoringUnit))
                  ? "Matchresultat matas in här per boll. Välj vinnare, segermarginal och hål kvar så räknas lagens tabellpoäng automatiskt."
                  : usesScoreComparedTeamMatchResults(selectedScoringUnit.round, scoringModelForUnit(selectedScoringUnit), unitFormat(selectedScoringUnit))
                  ? "Här matar du in lagens poängbogey för denna 9-hålsdel. Högst resultat får vinstpoängen automatiskt och resultatet visas som poängbogey."
                  : selectedScoringUnit.round.playMode === "team"
                  ? `Denna runda rankar lag. Fyll i spelarnas ${resultScoreLabel(selectedScoringUnit.round, selectedScoringUnit.part?.format, scoringModelForUnit(selectedScoringUnit)).toLowerCase()} så summeras laget och tabellpoängen räknas automatiskt.`
                  : "Denna runda rankar spelare. Spelarnas tabellpoäng summeras ändå till laget i totalställningen när tävlingen har lag."}{" "}
                Uppdelade 9-hålsdelar matas in var för sig.
              </div>
              <div className="mt-4 grid gap-3">
                {(() => {
                  const unitResults = ensureUnitResults(selectedScoringUnit);
                  const playoffIds = firstPlaceTieIds(selectedScoringUnit, unitResults);
                  const selectedUnitModel = scoringModelForUnit(selectedScoringUnit);
                  const selectedUnitFormat = unitFormat(selectedScoringUnit);
                  if (usesTeamPoolForMatchRound(selectedScoringUnit.round, config.teams.length)) {
                    const matchRows = pairingsForResultKey(selectedScoringUnit.round, selectedScoringUnit.resultKey);
                    const model = selectedUnitModel;

                    return matchRows.length > 0 ? (
                      matchRows.map(({ item, itemIndex, pairing }) => {
                        const playerA = config.players.find((player) => player.id === pairing.playerIds[0]) ?? null;
                        const playerB = config.players.find((player) => player.id === pairing.playerIds[1]) ?? null;
                        const matchupLabel =
                          playerA && playerB ? `${firstName(playerA.name)} vs ${firstName(playerB.name)}` : "Välj spelare i spelschemat";

                        return (
                          <div key={pairing.id} className="rounded-[20px] border border-white/10 bg-black/20 p-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <div className="text-xs uppercase tracking-[0.16em] text-white/42">
                                  Boll {itemIndex + 1}
                                  {matchPairingSegments(selectedScoringUnit.round).length > 1 ? ` · ${segmentLabel(pairing.segment)}` : ""}
                                </div>
                                <div className="mt-1 font-semibold">{matchupLabel}</div>
                              </div>
                              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                                {item.time || "--"}
                              </div>
                            </div>

                            <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_160px]">
                              <label className="space-y-2">
                                <span className="text-xs uppercase tracking-[0.16em] text-white/42">Vinnare</span>
                                <select
                                  disabled={selectedRoundLocked}
                                  value={pairing.halved ? "draw" : pairing.winnerId ?? ""}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (!value) {
                                      patchSchedulePairing(selectedScoringUnit.round, item, pairing.id, {
                                        winnerId: null,
                                        halved: false,
                                        matchPoints: null,
                                        holesRemaining: null,
                                        resultLabel: "",
                                      });
                                      return;
                                    }
                                    if (value === "draw") {
                                      patchSchedulePairing(selectedScoringUnit.round, item, pairing.id, {
                                        winnerId: null,
                                        halved: true,
                                        matchPoints: null,
                                        holesRemaining: null,
                                      });
                                      return;
                                    }
                                    patchSchedulePairing(selectedScoringUnit.round, item, pairing.id, {
                                      winnerId: value,
                                      halved: false,
                                      matchPoints: pairing.matchPoints ?? 1,
                                      holesRemaining: pairing.holesRemaining ?? 0,
                                    });
                                  }}
                                  className={inputClass(selectedRoundLocked)}
                                >
                                  <option value="">Ej spelad</option>
                                  {playerA ? <option value={playerA.id}>{firstName(playerA.name)}</option> : null}
                                  {playerB ? <option value={playerB.id}>{firstName(playerB.name)}</option> : null}
                                  <option value="draw">Delad</option>
                                </select>
                              </label>

                              <label className="space-y-2">
                                <span className="text-xs uppercase tracking-[0.16em] text-white/42">Poäng i matchen</span>
                                <input
                                  disabled={selectedRoundLocked || pairing.halved || !pairing.winnerId}
                                  type="number"
                                  min={1}
                                  value={pairing.matchPoints ?? ""}
                                  onChange={(e) =>
                                    patchSchedulePairing(selectedScoringUnit.round, item, pairing.id, {
                                      matchPoints: e.target.value === "" ? null : Number(e.target.value),
                                    })
                                  }
                                  placeholder="2"
                                  className={inputClass(selectedRoundLocked || pairing.halved || !pairing.winnerId)}
                                />
                              </label>

                              <label className="space-y-2">
                                <span className="text-xs uppercase tracking-[0.16em] text-white/42">Hål kvar</span>
                                <input
                                  disabled={selectedRoundLocked || pairing.halved || !pairing.winnerId}
                                  type="number"
                                  min={0}
                                  value={pairing.holesRemaining ?? ""}
                                  onChange={(e) =>
                                    patchSchedulePairing(selectedScoringUnit.round, item, pairing.id, {
                                      holesRemaining: e.target.value === "" ? null : Number(e.target.value),
                                    })
                                  }
                                  placeholder="1"
                                  className={inputClass(selectedRoundLocked || pairing.halved || !pairing.winnerId)}
                                />
                              </label>
                            </div>

                            <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/72">
                                <span className="text-white/45">Visas i schemat:</span>{" "}
                                <span className="font-semibold text-white">{pairing.resultLabel || "Inget resultat än"}</span>
                              </div>
                              <div className="rounded-2xl border border-sky-300/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-50">
                                Tabellpoäng: vinst {fmtPoints(model.winPoints)}p · delad {fmtPoints(model.drawPoints)}p · förlust {fmtPoints(model.lossPoints)}p
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-white/52">
                        Inga matcher att rapportera ännu. Lägg först upp bollar och parningar i spelschemat.
                      </div>
                    );
                  }

                  if (usesScoreComparedTeamMatchResults(selectedScoringUnit.round, selectedUnitModel, selectedUnitFormat)) {
                    const teamNamesById = new Map(competitorsForRound(config, selectedScoringUnit.round).map((competitor) => [competitor.id, competitor.name]));
                    const scoreItems = selectedScoringUnit.round.schedule.filter((item) => item.competitorIds.length >= 2);

                    return scoreItems.length > 0 ? (
                      scoreItems.map((item, itemIndex) => {
                        const [teamAId, teamBId] = item.competitorIds;
                        const teamALabel = teamNamesById.get(teamAId) ?? teamAId;
                        const teamBLabel = teamNamesById.get(teamBId) ?? teamBId;
                        const teamAResult = unitResults.find((row) => row.competitorId === teamAId) ?? createResult(teamAId);
                        const teamBResult = unitResults.find((row) => row.competitorId === teamBId) ?? createResult(teamBId);
                        const matchupLabel = scoreComparedMatchupLabel(
                          teamALabel,
                          teamBLabel,
                          typeof teamAResult.rawScore === "number" && Number.isFinite(teamAResult.rawScore) ? teamAResult.rawScore : null,
                          typeof teamBResult.rawScore === "number" && Number.isFinite(teamBResult.rawScore) ? teamBResult.rawScore : null,
                          selectedUnitFormat,
                          selectedUnitModel
                        );

                        return (
                          <div key={item.id} className="rounded-[20px] border border-white/10 bg-black/20 p-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <div className="text-xs uppercase tracking-[0.16em] text-white/42">Boll {itemIndex + 1}</div>
                                <div className="mt-1 font-semibold">{teamALabel} vs {teamBLabel}</div>
                              </div>
                              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                                {item.time || "--"}
                              </div>
                            </div>

                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <label className="space-y-2">
                                <span className="text-xs uppercase tracking-[0.16em] text-white/42">{teamALabel}</span>
                                <input
                                  disabled={selectedRoundLocked}
                                  type="number"
                                  value={teamAResult.rawScore ?? ""}
                                  onChange={(e) => patchScoreComparedTeamResult(selectedScoringUnit, item, teamAId, e.target.value)}
                                  placeholder="34"
                                  className={inputClass(selectedRoundLocked)}
                                />
                              </label>
                              <label className="space-y-2">
                                <span className="text-xs uppercase tracking-[0.16em] text-white/42">{teamBLabel}</span>
                                <input
                                  disabled={selectedRoundLocked}
                                  type="number"
                                  value={teamBResult.rawScore ?? ""}
                                  onChange={(e) => patchScoreComparedTeamResult(selectedScoringUnit, item, teamBId, e.target.value)}
                                  placeholder="31"
                                  className={inputClass(selectedRoundLocked)}
                                />
                              </label>
                            </div>

                            <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/72">
                                <span className="text-white/45">Visas som:</span>{" "}
                                <span className="font-semibold text-white">{matchupLabel || "Inget resultat än"}</span>
                              </div>
                              <div className="rounded-2xl border border-sky-300/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-50">
                                Tabellpoäng: vinst {fmtPoints(selectedUnitModel.winPoints)}p · delad {fmtPoints(selectedUnitModel.drawPoints)}p · förlust {fmtPoints(selectedUnitModel.lossPoints)}p
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-white/52">
                        Inga matcher att rapportera ännu. Lägg först upp bollar i spelschemat.
                      </div>
                    );
                  }

                  if (usesStructuredTeamMatchResults(selectedScoringUnit.round, selectedUnitModel, selectedUnitFormat)) {
                    const teamNamesById = new Map(competitorsForRound(config, selectedScoringUnit.round).map((competitor) => [competitor.id, competitor.name]));
                    const matchItems = selectedScoringUnit.round.schedule.filter((item) => item.competitorIds.length >= 2);

                    return matchItems.length > 0 ? (
                      matchItems.map((rawItem, itemIndex) => {
                        const item = normalizeScheduleItemPairings(rawItem);
                        const matchResult = matchResultForItem(item, selectedScoringUnit.resultKey, selectedScoringUnit.round);
                        const [teamAId, teamBId] = item.competitorIds;
                        const teamALabel = teamNamesById.get(teamAId) ?? teamAId;
                        const teamBLabel = teamNamesById.get(teamBId) ?? teamBId;

                        return (
                          <div key={item.id} className="rounded-[20px] border border-white/10 bg-black/20 p-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <div className="text-xs uppercase tracking-[0.16em] text-white/42">Boll {itemIndex + 1}</div>
                                <div className="mt-1 font-semibold">{teamALabel} vs {teamBLabel}</div>
                              </div>
                              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                                {item.time || "--"}
                              </div>
                            </div>

                            <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_160px]">
                              <label className="space-y-2">
                                <span className="text-xs uppercase tracking-[0.16em] text-white/42">Vinnare</span>
                                <select
                                  disabled={selectedRoundLocked}
                                  value={matchResult.matchHalved ? "draw" : matchResult.matchWinnerCompetitorId ?? ""}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (!value) {
                                      patchScheduleItemMatchResult(selectedScoringUnit.round, selectedScoringUnit.resultKey, item.id, {
                                        matchWinnerCompetitorId: null,
                                        matchHalved: false,
                                        matchPoints: null,
                                        holesRemaining: null,
                                        matchResultLabel: "",
                                      });
                                      return;
                                    }
                                    if (value === "draw") {
                                      patchScheduleItemMatchResult(selectedScoringUnit.round, selectedScoringUnit.resultKey, item.id, {
                                        matchWinnerCompetitorId: null,
                                        matchHalved: true,
                                        matchPoints: null,
                                        holesRemaining: null,
                                      });
                                      return;
                                    }
                                    patchScheduleItemMatchResult(selectedScoringUnit.round, selectedScoringUnit.resultKey, item.id, {
                                      matchWinnerCompetitorId: value,
                                      matchHalved: false,
                                      matchPoints: matchResult.matchPoints ?? 1,
                                      holesRemaining: matchResult.holesRemaining ?? 0,
                                    });
                                  }}
                                  className={inputClass(selectedRoundLocked)}
                                >
                                  <option value="">Ej spelad</option>
                                  <option value={teamAId}>{teamALabel}</option>
                                  <option value={teamBId}>{teamBLabel}</option>
                                  <option value="draw">Delad</option>
                                </select>
                              </label>

                              <label className="space-y-2">
                                <span className="text-xs uppercase tracking-[0.16em] text-white/42">Poäng i matchen</span>
                                <input
                                  disabled={selectedRoundLocked || matchResult.matchHalved || !matchResult.matchWinnerCompetitorId}
                                  type="number"
                                  min={1}
                                  value={matchResult.matchPoints ?? ""}
                                  onChange={(e) =>
                                    patchScheduleItemMatchResult(selectedScoringUnit.round, selectedScoringUnit.resultKey, item.id, {
                                      matchPoints: e.target.value === "" ? null : Number(e.target.value),
                                    })
                                  }
                                  placeholder="2"
                                  className={inputClass(selectedRoundLocked || matchResult.matchHalved || !matchResult.matchWinnerCompetitorId)}
                                />
                              </label>

                              <label className="space-y-2">
                                <span className="text-xs uppercase tracking-[0.16em] text-white/42">Hål kvar</span>
                                <input
                                  disabled={selectedRoundLocked || matchResult.matchHalved || !matchResult.matchWinnerCompetitorId}
                                  type="number"
                                  min={0}
                                  value={matchResult.holesRemaining ?? ""}
                                  onChange={(e) =>
                                    patchScheduleItemMatchResult(selectedScoringUnit.round, selectedScoringUnit.resultKey, item.id, {
                                      holesRemaining: e.target.value === "" ? null : Number(e.target.value),
                                    })
                                  }
                                  placeholder="1"
                                  className={inputClass(selectedRoundLocked || matchResult.matchHalved || !matchResult.matchWinnerCompetitorId)}
                                />
                              </label>
                            </div>

                            <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/72">
                                <span className="text-white/45">Resultat:</span>{" "}
                                <span className="font-semibold text-white">{matchResult.matchResultLabel || "Inget resultat än"}</span>
                              </div>
                              <div className="rounded-2xl border border-sky-300/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-50">
                                Tabellpoäng: vinst {fmtPoints(selectedUnitModel.winPoints)}p · delad {fmtPoints(selectedUnitModel.drawPoints)}p · förlust {fmtPoints(selectedUnitModel.lossPoints)}p
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-white/52">
                        Inga matcher att rapportera ännu. Lägg först upp bollar i spelschemat.
                      </div>
                    );
                  }

                  return competitorsForRound(config, selectedScoringUnit.round).map((competitor) => {
                  const result = unitResults.find((row) => row.competitorId === competitor.id) ?? createResult(competitor.id);
                  const model = selectedUnitModel;
                  const format = unitFormat(selectedScoringUnit);
                  const members = competitor.type === "team" ? teamMembers(competitor.id) : [];
                  const usePlayerScores = model.kind === "placement" && competitor.type === "team" && usesPlayerBallScores(format);
                  const showPlayoff = playoffIds.has(competitor.id);
                  return (
                    <div key={competitor.id} className="rounded-[20px] border border-white/10 bg-black/20 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold">{competitor.name}</div>
                        {competitor.type === "player" && competitor.teamName ? <TeamPill competitor={competitor} /> : null}
                      </div>
                      {usePlayerScores ? (
                        <div className="mt-3 grid gap-2">
                          {members.map((member) => (
                            <label key={member.id} className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                              <span className="truncate text-sm font-medium">{firstName(member.name)}</span>
                              <input
                                disabled={selectedRoundLocked}
                                type="number"
                                value={result.playerScores?.[member.id] ?? ""}
                                onChange={(e) => patchPlayerScore(selectedScoringUnit, competitor.id, member.id, e.target.value)}
                                placeholder="34"
                                className="min-h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-right text-sm outline-none focus:border-white/30"
                              />
                            </label>
                          ))}
                        </div>
                      ) : model.kind === "placement" ? (
                        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_150px]">
                          <label className="space-y-2">
                            <span className="text-xs uppercase tracking-[0.16em] text-white/42">Resultattext</span>
                            <input
                              disabled={selectedRoundLocked}
                              value={result.scoreLabel}
                              onChange={(e) => patchUnitResult(selectedScoringUnit, competitor.id, { scoreLabel: e.target.value })}
                              placeholder="34 p"
                              className={inputClass(selectedRoundLocked)}
                            />
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs uppercase tracking-[0.16em] text-white/42">{resultScoreLabel(selectedScoringUnit.round, selectedScoringUnit.part?.format, model)}</span>
                            <input
                              disabled={selectedRoundLocked}
                              type="number"
                              value={result.rawScore ?? ""}
                              onChange={(e) => patchUnitResult(selectedScoringUnit, competitor.id, { rawScore: e.target.value === "" ? null : Number(e.target.value) })}
                              placeholder="34"
                              className={inputClass(selectedRoundLocked)}
                            />
                          </label>
                        </div>
                      ) : (
                        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_150px]">
                          <label className="space-y-2">
                            <span className="text-xs uppercase tracking-[0.16em] text-white/42">Resultat</span>
                            <input
                              disabled={selectedRoundLocked}
                              value={result.scoreLabel}
                              onChange={(e) => patchUnitResult(selectedScoringUnit, competitor.id, { scoreLabel: e.target.value })}
                              placeholder="2&1, delad eller vinst"
                              className={inputClass(selectedRoundLocked)}
                            />
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs uppercase tracking-[0.16em] text-white/42">Poäng till laget</span>
                            <input
                              disabled={selectedRoundLocked}
                              type="number"
                              value={result.points}
                              onChange={(e) => patchUnitResult(selectedScoringUnit, competitor.id, { points: Number(e.target.value) || 0 })}
                              placeholder="2"
                              className={inputClass(selectedRoundLocked)}
                            />
                          </label>
                        </div>
                      )}
                      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_160px]">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/72">
                          <span className="text-white/45">Resultat:</span>{" "}
                          <span className="font-semibold text-white">{result.rawScore ?? "-"}</span>
                          {result.scoreLabel ? <span className="ml-2 text-white/55">{result.scoreLabel}</span> : null}
                        </div>
                        <div className="rounded-2xl border border-sky-300/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-50">
                          Tabellpoäng <span className="font-semibold tabular-nums">{fmtPoints(result.points)}</span>
                        </div>
                        {showPlayoff ? (
                          <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3">
                            <input
                              disabled={selectedRoundLocked}
                              type="checkbox"
                              checked={result.winnerOverride}
                              onChange={(e) => setPlayoffWinner(selectedScoringUnit, competitor.id, e.target.checked)}
                            />
                            <span className="text-sm text-amber-50">Vann särspel</span>
                          </label>
                        ) : null}
                      </div>
                      <textarea disabled={selectedRoundLocked} value={result.note} onChange={(e) => patchUnitResult(selectedScoringUnit, competitor.id, { note: e.target.value })} placeholder="Anteckning eller särspel" className={`${inputClass(selectedRoundLocked)} mt-3 min-h-20`} />
                    </div>
                  );
                });
                })()}
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-white/10 px-4 py-8 text-center text-white/60">
              Skapa en speldag först.
            </div>
          )}
        </section>
      ) : null}

      {tab === "rules" ? (
        <section className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4 md:p-5">
          <textarea
            disabled={locked}
            value={competition.rules_content}
            onChange={(e) => patchCompetition({ rules_content: e.target.value })}
            className={`${inputClass(locked)} min-h-[420px]`}
            placeholder="Regler, poängsystem, rundupplägg och specialregler."
          />
        </section>
      ) : null}

      <section className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
        Publicerad sida:{" "}
        {competition.status === "draft" ? (
          <span>inte synlig eftersom status är Utkast</span>
        ) : (
          <a className="text-white underline decoration-white/30" href={`/other-competitions/${competition.slug}`}>
            /other-competitions/{competition.slug}
          </a>
        )}
        <span className="block pt-1">Senast sparad i databasen: {fmtTime(initialCompetition.updated_at)}</span>
      </section>
    </main>
  );
}
