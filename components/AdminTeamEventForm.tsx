"use client";

import { useMemo, useState } from "react";
import AdminLockPreviewModal from "@/components/AdminLockPreviewModal";
import { buildTeamPreview, type PreviewEntry } from "@/lib/adminResultPreview";

type PlayerRow = {
  season_player_id: string;
  name: string;
  hcp: number;
  existing_dns: boolean;
  existing_lag_nr: number | null;
  existing_lag_score: number | null;
  existing_override?: number | null;
};

type TeamRow = {
  lag_nr: number;
  lag_score: number | null;
  members: string[];
};

type Entry = PreviewEntry;

type SavePayload = {
  entries: Entry[];
  lock?: boolean;
  unlock?: boolean;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Nätverksfel";
}

export default function AdminTeamEventForm({
  eventId,
  eventName,
  isLocked,
  players,
  initialTeams,
}: {
  eventId: string;
  eventName: string;
  isLocked: boolean;
  players: PlayerRow[];
  initialTeams: TeamRow[];
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [rows, setRows] = useState<Entry[]>(
    players.map((player) => ({
      season_player_id: player.season_player_id,
      gross_strokes: null,
      did_not_play: player.existing_dns ?? false,
      override_placing: player.existing_override ?? null,
      lag_nr: player.existing_lag_nr ?? null,
      lag_score: player.existing_lag_score ?? null,
    }))
  );

  const initialScoreMap = useMemo(() => {
    const map: Record<number, number | null> = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
    for (const team of initialTeams ?? []) {
      if (team?.lag_nr && team.lag_score != null) map[team.lag_nr] = team.lag_score;
    }
    for (const row of rows) {
      if (row.lag_nr && row.lag_score != null && map[row.lag_nr] == null) map[row.lag_nr] = row.lag_score;
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [teamScore, setTeamScore] = useState<Record<number, number | null>>(initialScoreMap);

  const preview = useMemo(
    () =>
      buildTeamPreview(
        players.map((player) => ({
          season_player_id: player.season_player_id,
          name: player.name,
          hcp: player.hcp,
        })),
        rows
      ),
    [players, rows]
  );

  function patchRow(id: string, patchValue: Partial<Entry>) {
    setRows((prev) => prev.map((row) => (row.season_player_id === id ? { ...row, ...patchValue } : row)));
  }

  function setTeamScoreFor(lag: number, value: number | null) {
    setTeamScore((prev) => ({ ...prev, [lag]: value }));
    setRows((prev) => prev.map((row) => (row.lag_nr === lag ? { ...row, lag_score: value } : row)));
  }

  async function callApi(mode: "save" | "lock" | "unlock") {
    setBusy(true);
    setMsg(null);

    const payload: SavePayload = { entries: rows };
    if (mode === "lock") payload.lock = true;
    if (mode === "unlock") payload.unlock = true;

    try {
      const res = await fetch(`/api/admin/events/${eventId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg(`Fel: ${data?.error ?? "Okänt fel"}`);
        setBusy(false);
        return;
      }

      if (mode === "unlock") {
        setMsg("Tävlingen är upplåst ✅");
        window.location.reload();
        return;
      }

      if (mode === "lock") {
        setMsg("Tävlingen är låst ✅");
        window.location.reload();
        return;
      }

      setMsg("Sparat ✅ Lagpreviewn nedan visar hur placeringarna ser ut just nu.");
      setBusy(false);
    } catch (error: unknown) {
      setMsg(`Fel: ${getErrorMessage(error)}`);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/70">
        <div className="text-xs uppercase tracking-[0.28em] text-white/45">Lagtävling</div>
        <p className="mt-3 leading-6">
          Välj lag per spelare och fyll i ett gemensamt lagbrutto för varje lag. Om lag hamnar lika kan
          särspel användas för att styra intern ordning.
        </p>
      </div>

      {msg && (
        <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85">
          {msg}
        </div>
      )}

      <section className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_12px_48px_rgba(0,0,0,0.14)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-white/45">Lagbrutto</div>
            <h2 className="mt-2 text-xl font-semibold text-white">Sätt score för lagen först</h2>
          </div>
          <div className="text-sm text-white/55">Poängen och placeringarna räknas per lag.</div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((lag) => (
            <label
              key={lag}
              className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-3"
            >
              <span className="text-xs uppercase tracking-[0.24em] text-white/45">Lag {lag}</span>
              <input
                type="number"
                inputMode="numeric"
                value={teamScore[lag] ?? ""}
                disabled={busy || isLocked}
                onChange={(e) => setTeamScoreFor(lag, e.target.value === "" ? null : Number(e.target.value))}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-lg tabular-nums text-white outline-none transition focus:border-white/30"
              />
            </label>
          ))}
        </div>
      </section>

      <div className="grid gap-3">
        {players.map((player) => {
          const row = rows.find((entry) => entry.season_player_id === player.season_player_id)!;

          return (
            <div
              key={player.season_player_id}
              className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.12)]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="text-xl font-semibold tracking-tight text-white">{player.name}</div>
                  <div className="mt-1 text-sm text-white/55">HCP {player.hcp.toFixed(1)}</div>
                </div>

                <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,180px)_minmax(0,180px)_auto]">
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.24em] text-white/45">Lag</span>
                    <select
                      value={row.lag_nr ?? ""}
                      disabled={busy || isLocked}
                      onChange={(e) => {
                        const lag = e.target.value === "" ? null : Number(e.target.value);
                        patchRow(player.season_player_id, {
                          lag_nr: lag,
                          lag_score: lag ? (teamScore[lag] ?? null) : null,
                        });
                      }}
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-lg text-white outline-none transition focus:border-white/30"
                    >
                      <option value="">Välj lag</option>
                      <option value="1">Lag 1</option>
                      <option value="2">Lag 2</option>
                      <option value="3">Lag 3</option>
                      <option value="4">Lag 4</option>
                      <option value="5">Lag 5</option>
                      <option value="6">Lag 6</option>
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.24em] text-white/45">Särspel</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={row.override_placing ?? ""}
                      disabled={busy || isLocked}
                      onChange={(e) =>
                        patchRow(player.season_player_id, {
                          override_placing: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-lg tabular-nums text-white outline-none transition focus:border-white/30"
                    />
                  </label>

                  <label className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={row.did_not_play}
                      disabled={busy || isLocked}
                      onChange={(e) => patchRow(player.season_player_id, { did_not_play: e.target.checked })}
                      className="h-5 w-5 rounded border-white/20 bg-transparent"
                    />
                    <div>
                      <div className="text-sm font-medium text-white">DNS</div>
                      <div className="text-xs text-white/50">Spelaren deltog inte</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!isLocked && (
        <section className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/6 to-white/[0.03] p-4 shadow-[0_16px_60px_rgba(0,0,0,0.16)] md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-white/45">Preview innan låsning</div>
              <h2 className="mt-2 text-xl font-semibold text-white">Verifiera lagställningen</h2>
              <p className="mt-2 max-w-2xl text-sm text-white/60">
                Se vilka lag som är klara, vilka spelare som saknar lag och hur ordningen ser ut innan du låser.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/40">Rankade lag</div>
                <div className="mt-2 text-2xl font-semibold text-white">{preview.rankedTeams.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/40">Ej klara lag</div>
                <div className="mt-2 text-2xl font-semibold text-white">{preview.pendingTeams.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/40">Utan lag</div>
                <div className="mt-2 text-2xl font-semibold text-white">{preview.unassigned.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/40">DNS</div>
                <div className="mt-2 text-2xl font-semibold text-white">{preview.dns.length}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {preview.teams.map((team) => (
              <div key={team.lagNr} className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-semibold text-white">Lag {team.lagNr}</span>
                      {team.placing != null && (
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-100">
                          #{team.placing}
                        </span>
                      )}
                      {!team.complete && (
                        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-white/65">
                          Ej komplett
                        </span>
                      )}
                    </div>
                    <div className="mt-1 break-words text-sm text-white/55">{team.memberNames.join(", ") || "Inga spelare"}</div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">Brutto</div>
                      <div className="mt-1 text-lg font-semibold text-white">{team.score ?? "—"}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">Särspel</div>
                      <div className="mt-1 text-lg font-semibold text-white">{team.overridePlacing ?? "—"}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">Spelare</div>
                      <div className="mt-1 text-lg font-semibold text-white">{team.playerCount}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {(preview.unassigned.length > 0 || preview.dns.length > 0) && (
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-white/45">Utan lag</div>
                  <div className="mt-3 text-sm leading-6 text-white/75">
                    {preview.unassigned.length > 0
                      ? preview.unassigned.map((player) => player.name).join(", ")
                      : "Alla spelare har lag."}
                  </div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-white/45">DNS</div>
                  <div className="mt-3 text-sm leading-6 text-white/75">
                    {preview.dns.length > 0 ? preview.dns.map((player) => player.name).join(", ") : "Inga DNS."}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <div className="rounded-[26px] border border-white/10 bg-black/20 p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Lås först när lagen stämmer</div>
            <p className="mt-1 text-sm text-white/55">
              Spara utkast, granska lagställningen och bekräfta sedan låsning i previewn.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            {!isLocked && (
              <>
                <button
                  type="button"
                  onClick={() => callApi("save")}
                  disabled={busy}
                  className="rounded-2xl border border-white/10 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Sparar..." : "Spara utkast"}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  disabled={busy}
                  className="rounded-2xl border border-emerald-400/20 bg-emerald-500/15 px-5 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Förhandsgranska & lås
                </button>
              </>
            )}

            {isLocked && (
              <button
                type="button"
                onClick={() => callApi("unlock")}
                disabled={busy}
                className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Jobbar..." : "Lås upp"}
              </button>
            )}
          </div>
        </div>
      </div>

      <AdminLockPreviewModal
        open={previewOpen}
        busy={busy}
        title={`Lås ${eventName}`}
        description="Kontrollera lagställningen en sista gång. När du bekräftar låses tävlingen och resultatet blir officiellt."
        onClose={() => setPreviewOpen(false)}
        onConfirm={() => callApi("lock")}
      >
        <div className="space-y-3">
          {preview.teams.map((team) => (
            <div key={team.lagNr} className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold text-white">Lag {team.lagNr}</span>
                    {team.placing != null && (
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-100">
                        #{team.placing}
                      </span>
                    )}
                    {!team.complete && (
                      <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-white/65">
                        Ej komplett
                      </span>
                    )}
                  </div>
                  <div className="mt-1 break-words text-sm text-white/55">{team.memberNames.join(", ") || "Inga spelare"}</div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">Brutto</div>
                    <div className="mt-1 text-lg font-semibold text-white">{team.score ?? "—"}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">Särspel</div>
                    <div className="mt-1 text-lg font-semibold text-white">{team.overridePlacing ?? "—"}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">Spelare</div>
                    <div className="mt-1 text-lg font-semibold text-white">{team.playerCount}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {(preview.unassigned.length > 0 || preview.dns.length > 0) && (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.24em] text-white/45">Utan lag</div>
                <div className="mt-3 text-sm leading-6 text-white/75">
                  {preview.unassigned.length > 0
                    ? preview.unassigned.map((player) => player.name).join(", ")
                    : "Alla spelare har lag."}
                </div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.24em] text-white/45">DNS</div>
                <div className="mt-3 text-sm leading-6 text-white/75">
                  {preview.dns.length > 0 ? preview.dns.map((player) => player.name).join(", ") : "Inga DNS."}
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminLockPreviewModal>
    </div>
  );
}
