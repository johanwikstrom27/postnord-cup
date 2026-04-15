"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  OtherCompetitionConfig,
  OtherCompetitionPlayer,
  OtherCompetitionResult,
  OtherCompetitionRow,
  OtherCompetitionRound,
  OtherCompetitionScheduleItem,
  OtherCompetitionStatus,
  OtherCompetitionTeam,
  PostNordPersonSnapshot,
} from "@/lib/otherCompetitions/types";
import { normalizeConfig, normalizeSlug, statusLabel } from "@/lib/otherCompetitions/data";
import { FORMAT_OPTIONS, createRound, formatLabel } from "@/lib/otherCompetitions/templates";
import {
  competitorsForRound,
  resultTotal,
  roundLeaderboard,
  teamDisplayName,
  totalStandings,
} from "@/lib/otherCompetitions/scoring";

type Tab = "basic" | "players" | "teams" | "rounds" | "schedule" | "results" | "rules";

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

const TABS: Tab[] = ["basic", "players", "teams", "rounds", "schedule", "results", "rules"];

function tabLabel(tab: Tab) {
  if (tab === "basic") return "Översikt";
  if (tab === "players") return "Spelare";
  if (tab === "teams") return "Lag";
  if (tab === "rounds") return "Rundor";
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

function fmtTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("sv-SE", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const dirtyRef = useRef(false);
  const locked = competition.status === "locked";

  const rounds = useMemo(() => sortedRounds(config.rounds), [config.rounds]);
  const selectedRound = rounds.find((round) => round.id === selectedRoundId) ?? rounds[0] ?? null;
  const standings = useMemo(() => totalStandings(config), [config]);

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
          color: "#2dd4bf",
          memberIds: [],
          sortOrder: prev.teams.length,
        },
      ],
      settings: { ...prev.settings, isTeamCompetition: true },
    }));
  }

  function generateTeams() {
    if (locked) return;
    const teamSize = Math.max(1, Number(config.settings.teamSize ?? 2));
    const players = sortedPlayers(config.players);
    const teams: OtherCompetitionTeam[] = [];

    for (let i = 0; i < players.length; i += teamSize) {
      teams.push({
        id: crypto.randomUUID(),
        name: "",
        color: ["#2dd4bf", "#60a5fa", "#f59e0b", "#f472b6", "#a3e635", "#c084fc"][teams.length % 6],
        memberIds: players.slice(i, i + teamSize).map((player) => player.id),
        sortOrder: teams.length,
      });
    }

    patchConfig((prev) => ({ ...prev, teams, settings: { ...prev.settings, isTeamCompetition: true } }));
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

  function addRound(format = "stableford") {
    if (locked) return;
    const round = createRound(format as OtherCompetitionRound["format"], config.rounds.length);
    patchConfig((prev) => ({
      ...prev,
      rounds: [...prev.rounds, round],
      results: { ...prev.results, [round.id]: [] },
    }));
    setSelectedRoundId(round.id);
  }

  function patchRound(roundId: string, patch: Partial<OtherCompetitionRound>) {
    patchConfig((prev) => ({
      ...prev,
      rounds: prev.rounds.map((round) => (round.id === roundId ? { ...round, ...patch } : round)),
    }));
  }

  function removeRound(roundId: string) {
    if (locked) return;
    patchConfig((prev) => {
      const nextResults = { ...prev.results };
      delete nextResults[roundId];
      return {
        ...prev,
        rounds: prev.rounds.filter((round) => round.id !== roundId),
        results: nextResults,
      };
    });
    setSelectedRoundId("");
  }

  function ensureRoundResults(round: OtherCompetitionRound) {
    const competitors = competitorsForRound(config, round);
    const existing = new Map((config.results[round.id] ?? []).map((result) => [result.competitorId, result]));
    return competitors.map((competitor) => existing.get(competitor.id) ?? createResult(competitor.id));
  }

  function patchRoundResults(roundId: string, results: OtherCompetitionResult[]) {
    patchConfig((prev) => ({
      ...prev,
      results: { ...prev.results, [roundId]: results },
    }));
  }

  function patchResult(round: OtherCompetitionRound, competitorId: string, patch: Partial<OtherCompetitionResult>) {
    const results = ensureRoundResults(round).map((result) =>
      result.competitorId === competitorId ? { ...result, ...patch } : result
    );
    patchRoundResults(round.id, results);
  }

  function applyPlacementPoints(round: OtherCompetitionRound) {
    const results = ensureRoundResults(round);
    const ranked = roundLeaderboard({ ...config, results: { ...config.results, [round.id]: results } }, round);
    const distribution = round.scoringModel.placementPoints;
    const byId = new Map(ranked.map((row) => [row.competitor.id, distribution[(row.placement ?? 0) - 1] ?? 0]));
    patchRoundResults(
      round.id,
      results.map((result) => ({ ...result, points: byId.get(result.competitorId) ?? result.points }))
    );
  }

  function addScheduleItem(round: OtherCompetitionRound) {
    const item: OtherCompetitionScheduleItem = {
      id: crypto.randomUUID(),
      time: "",
      title: `Boll ${round.schedule.length + 1}`,
      competitorIds: [],
      note: "",
    };
    patchRound(round.id, { schedule: [...round.schedule, item] });
  }

  function generateSchedule(round: OtherCompetitionRound) {
    if (locked) return;
    const competitors = competitorsForRound(config, round);
    const ballsCount = round.ballsCount > 0 ? round.ballsCount : Math.ceil(competitors.length / 4);
    const perBall = Math.max(1, Math.ceil(competitors.length / Math.max(1, ballsCount)));
    const schedule: OtherCompetitionScheduleItem[] = [];

    for (let i = 0; i < competitors.length; i += perBall) {
      schedule.push({
        id: crypto.randomUUID(),
        time: "",
        title: round.playMode === "team" ? `Match ${schedule.length + 1}` : `Boll ${schedule.length + 1}`,
        competitorIds: competitors.slice(i, i + perBall).map((competitor) => competitor.id),
        note: "",
      });
    }

    patchRound(round.id, { schedule, ballsCount });
  }

  function patchScheduleItem(round: OtherCompetitionRound, itemId: string, patch: Partial<OtherCompetitionScheduleItem>) {
    patchRound(round.id, {
      schedule: round.schedule.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    });
  }

  function removeScheduleItem(round: OtherCompetitionRound, itemId: string) {
    patchRound(round.id, { schedule: round.schedule.filter((item) => item.id !== itemId) });
  }

  const saveTone =
    saveState === "error"
      ? "text-red-200"
      : saveState === "saving"
        ? "text-amber-100"
        : saveState === "saved"
          ? "text-emerald-100"
          : "text-white/58";

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
            {sortedPlayers(config.players).map((player) => (
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
                <div className="mt-2 text-xs text-white/45">
                  {player.sourceLabel === "postnord" ? "Importerad som snapshot från PostNord Cup" : "Extern spelare i denna modul"}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "teams" ? (
        <section className="space-y-4">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <div className="grid gap-3 md:grid-cols-[160px_auto_auto_minmax(0,1fr)]">
              <input
                disabled={locked}
                type="number"
                min={1}
                value={config.settings.teamSize ?? 2}
                onChange={(e) => patchConfig((prev) => ({ ...prev, settings: { ...prev.settings, teamSize: Number(e.target.value) || 1 } }))}
                className={inputClass(locked)}
              />
              <button type="button" disabled={locked} onClick={addTeam} className={buttonClass()}>
                Lägg till lag
              </button>
              <button type="button" disabled={locked} onClick={generateTeams} className={buttonClass("primary")}>
                Generera lag
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
          </div>
          <div className="grid gap-3">
            {sortedTeams(config.teams).map((team) => (
              <div key={team.id} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_90px_auto]">
                  <input disabled={locked} value={team.name} onChange={(e) => patchTeam(team.id, { name: e.target.value })} placeholder={teamDisplayName(team, config.players)} className={inputClass(locked)} />
                  <input disabled={locked} type="color" value={team.color} onChange={(e) => patchTeam(team.id, { color: e.target.value })} className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-2" />
                  <button type="button" disabled={locked} onClick={() => removeTeam(team.id)} className={buttonClass("danger")}>
                    Ta bort
                  </button>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {sortedPlayers(config.players).map((player) => (
                    <label key={player.id} className="flex min-h-11 items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3">
                      <input
                        disabled={locked}
                        type="checkbox"
                        checked={team.memberIds.includes(player.id)}
                        onChange={(e) => {
                          const memberIds = e.target.checked
                            ? [...team.memberIds, player.id]
                            : team.memberIds.filter((id) => id !== player.id);
                          patchTeam(team.id, { memberIds });
                        }}
                      />
                      <span className="text-sm">{player.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "rounds" ? (
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
                Lägg till runda
              </button>
            </div>
          </div>

          {rounds.map((round) => (
            <div key={round.id} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <input disabled={locked} value={round.name} onChange={(e) => patchRound(round.id, { name: e.target.value })} className={inputClass(locked)} />
                <input disabled={locked} type="date" value={round.date} onChange={(e) => patchRound(round.id, { date: e.target.value })} className={inputClass(locked)} />
                <select
                  disabled={locked}
                  value={round.format}
                  onChange={(e) => {
                    const option = FORMAT_OPTIONS.find((item) => item.value === e.target.value);
                    patchRound(round.id, {
                      format: e.target.value as OtherCompetitionRound["format"],
                      playMode: option?.defaultMode ?? round.playMode,
                      scoringModel: { ...round.scoringModel, kind: option?.scoringKind ?? round.scoringModel.kind },
                    });
                  }}
                  className={inputClass(locked)}
                >
                  {FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input disabled={locked || round.format !== "custom"} value={round.customFormatName} onChange={(e) => patchRound(round.id, { customFormatName: e.target.value })} placeholder="Namn på eget format" className={inputClass(locked || round.format !== "custom")} />
                <input disabled={locked} type="number" min={1} value={round.holes} onChange={(e) => patchRound(round.id, { holes: Number(e.target.value) || 18 })} className={inputClass(locked)} />
                <select disabled={locked} value={round.playMode} onChange={(e) => patchRound(round.id, { playMode: e.target.value as OtherCompetitionRound["playMode"] })} className={inputClass(locked)}>
                  <option value="individual">Individuellt</option>
                  <option value="team">Lag</option>
                </select>
                <input disabled={locked} type="number" min={0} value={round.ballsCount} onChange={(e) => patchRound(round.id, { ballsCount: Number(e.target.value) || 0 })} placeholder="Antal bollar/matcher" className={inputClass(locked)} />
                <input
                  disabled={locked}
                  value={round.scoringModel.placementPoints.join("-")}
                  onChange={(e) =>
                    patchRound(round.id, {
                      scoringModel: {
                        ...round.scoringModel,
                        placementPoints: e.target.value
                          .split(/[-,;\s]+/)
                          .map((value) => Number(value.replace(",", ".")))
                          .filter((value) => Number.isFinite(value)),
                      },
                    })
                  }
                  placeholder="Placeringspoäng, t.ex. 6-5-4-3-2-1"
                  className={inputClass(locked)}
                />
                <input
                  disabled={locked}
                  value={`${round.scoringModel.winPoints}-${round.scoringModel.drawPoints}-${round.scoringModel.lossPoints}`}
                  onChange={(e) => {
                    const [win, draw, loss] = e.target.value.split(/[-,;\s]+/).map(Number);
                    patchRound(round.id, {
                      scoringModel: {
                        ...round.scoringModel,
                        winPoints: Number.isFinite(win) ? win : 2,
                        drawPoints: Number.isFinite(draw) ? draw : 1,
                        lossPoints: Number.isFinite(loss) ? loss : 0,
                      },
                    });
                  }}
                  placeholder="Vinst-oavgjort-förlust"
                  className={inputClass(locked)}
                />
                <input
                  disabled={locked}
                  type="number"
                  value={round.scoringModel.maxPoints ?? ""}
                  onChange={(e) =>
                    patchRound(round.id, {
                      scoringModel: {
                        ...round.scoringModel,
                        maxPoints: e.target.value === "" ? null : Number(e.target.value),
                      },
                    })
                  }
                  placeholder="Maxpoäng"
                  className={inputClass(locked)}
                />
                <input
                  disabled={locked}
                  type="number"
                  value={round.scoringModel.bonusPoints}
                  onChange={(e) =>
                    patchRound(round.id, {
                      scoringModel: { ...round.scoringModel, bonusPoints: Number(e.target.value) || 0 },
                    })
                  }
                  placeholder="Standard bonus"
                  className={inputClass(locked)}
                />
              </div>
              <textarea
                disabled={locked}
                value={round.scoringModel.customText}
                onChange={(e) => patchRound(round.id, { scoringModel: { ...round.scoringModel, customText: e.target.value } })}
                placeholder="Custom poängmodell, specialregler eller domslut"
                className={`${inputClass(locked)} mt-3 min-h-24`}
              />
              <div className="mt-3 flex justify-end">
                <button type="button" disabled={locked} onClick={() => removeRound(round.id)} className={buttonClass("danger")}>
                  Ta bort runda
                </button>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {tab === "schedule" ? (
        <section className="space-y-4">
          {rounds.map((round) => {
            const competitors = competitorsForRound(config, round);
            return (
              <div key={round.id} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{round.name}</h2>
                    <div className="text-sm text-white/55">{formatLabel(round.format, round.customFormatName)}</div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button type="button" disabled={locked} onClick={() => generateSchedule(round)} className={buttonClass("primary")}>
                      Generera
                    </button>
                    <button type="button" disabled={locked} onClick={() => addScheduleItem(round)} className={buttonClass()}>
                      Lägg till
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3">
                  {round.schedule.map((item) => (
                    <div key={item.id} className="rounded-[20px] border border-white/10 bg-black/20 p-3">
                      <div className="grid gap-3 md:grid-cols-[130px_minmax(0,1fr)_auto]">
                        <input disabled={locked} value={item.time} onChange={(e) => patchScheduleItem(round, item.id, { time: e.target.value })} placeholder="Tid" className={inputClass(locked)} />
                        <input disabled={locked} value={item.title} onChange={(e) => patchScheduleItem(round, item.id, { title: e.target.value })} placeholder="Boll/match" className={inputClass(locked)} />
                        <button type="button" disabled={locked} onClick={() => removeScheduleItem(round, item.id)} className={buttonClass("danger")}>
                          Ta bort
                        </button>
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {competitors.map((competitor) => (
                          <label key={competitor.id} className="flex min-h-10 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3">
                            <input
                              disabled={locked}
                              type="checkbox"
                              checked={item.competitorIds.includes(competitor.id)}
                              onChange={(e) => {
                                const competitorIds = e.target.checked
                                  ? [...item.competitorIds, competitor.id]
                                  : item.competitorIds.filter((id) => id !== competitor.id);
                                patchScheduleItem(round, item.id, { competitorIds });
                              }}
                            />
                            <span className="text-sm">{competitor.name}</span>
                          </label>
                        ))}
                      </div>
                      <textarea disabled={locked} value={item.note} onChange={(e) => patchScheduleItem(round, item.id, { note: e.target.value })} placeholder="Notering" className={`${inputClass(locked)} mt-3 min-h-20`} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      {tab === "results" ? (
        <section className="space-y-4">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <select value={selectedRound?.id ?? ""} onChange={(e) => setSelectedRoundId(e.target.value)} className={inputClass(false)}>
              {rounds.map((round) => (
                <option key={round.id} value={round.id}>
                  {round.name}
                </option>
              ))}
            </select>
          </div>

          {selectedRound ? (
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{selectedRound.name}</h2>
                  <div className="text-sm text-white/55">{formatLabel(selectedRound.format, selectedRound.customFormatName)}</div>
                </div>
                <button type="button" disabled={locked} onClick={() => applyPlacementPoints(selectedRound)} className={buttonClass("primary")}>
                  Räkna placeringspoäng
                </button>
              </div>
              <div className="mt-4 grid gap-3">
                {competitorsForRound(config, selectedRound).map((competitor) => {
                  const result = ensureRoundResults(selectedRound).find((row) => row.competitorId === competitor.id) ?? createResult(competitor.id);
                  return (
                    <div key={competitor.id} className="rounded-[20px] border border-white/10 bg-black/20 p-3">
                      <div className="font-semibold">{competitor.name}</div>
                      <div className="mt-3 grid gap-3 md:grid-cols-4">
                        <input disabled={locked} value={result.scoreLabel} onChange={(e) => patchResult(selectedRound, competitor.id, { scoreLabel: e.target.value })} placeholder="Resultattext" className={inputClass(locked)} />
                        <input
                          disabled={locked}
                          type="number"
                          value={result.rawScore ?? ""}
                          onChange={(e) => patchResult(selectedRound, competitor.id, { rawScore: e.target.value === "" ? null : Number(e.target.value) })}
                          placeholder="Sorteringsscore"
                          className={inputClass(locked)}
                        />
                        <input disabled={locked} type="number" value={result.points} onChange={(e) => patchResult(selectedRound, competitor.id, { points: Number(e.target.value) || 0 })} placeholder="Poäng" className={inputClass(locked)} />
                        <input disabled={locked} type="number" value={result.adjustment} onChange={(e) => patchResult(selectedRound, competitor.id, { adjustment: Number(e.target.value) || 0 })} placeholder="Justering" className={inputClass(locked)} />
                        <input disabled={locked} type="number" value={result.bonus} onChange={(e) => patchResult(selectedRound, competitor.id, { bonus: Number(e.target.value) || 0 })} placeholder="Bonus" className={inputClass(locked)} />
                        <input
                          disabled={locked}
                          type="number"
                          value={result.placementOverride ?? ""}
                          onChange={(e) => patchResult(selectedRound, competitor.id, { placementOverride: e.target.value === "" ? null : Number(e.target.value) })}
                          placeholder="Placering override"
                          className={inputClass(locked)}
                        />
                        <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3">
                          <input disabled={locked} type="checkbox" checked={result.winnerOverride} onChange={(e) => patchResult(selectedRound, competitor.id, { winnerOverride: e.target.checked })} />
                          <span className="text-sm">Vinnaroverride</span>
                        </label>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/72">
                          Summa {resultTotal(result, selectedRound)}
                        </div>
                      </div>
                      <textarea disabled={locked} value={result.note} onChange={(e) => patchResult(selectedRound, competitor.id, { note: e.target.value })} placeholder="Anteckning, särspel eller domslut" className={`${inputClass(locked)} mt-3 min-h-20`} />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-white/10 px-4 py-8 text-center text-white/60">
              Skapa en runda först.
            </div>
          )}

          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <h2 className="text-xl font-semibold">Slutställning och manuella overrides</h2>
            <div className="mt-4 grid gap-2">
              {standings.map((row) => (
                <div key={row.competitor.id} className="grid grid-cols-[54px_minmax(0,1fr)_110px_120px] items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                  <div className="font-semibold tabular-nums">{row.placement ?? "-"}</div>
                  <div className="min-w-0 truncate">{row.competitor.name}</div>
                  <div className="text-right tabular-nums">{row.total}</div>
                  <input
                    disabled={locked}
                    type="number"
                    value={config.finalPlacementOverrides[row.competitor.id] ?? ""}
                    onChange={(e) =>
                      patchConfig((prev) => ({
                        ...prev,
                        finalPlacementOverrides: {
                          ...prev.finalPlacementOverrides,
                          [row.competitor.id]: e.target.value === "" ? null : Number(e.target.value),
                        },
                      }))
                    }
                    placeholder="Override"
                    className="min-h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
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
