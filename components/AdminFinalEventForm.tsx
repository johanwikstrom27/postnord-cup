"use client";

import { useMemo, useState } from "react";
import AdminLockPreviewModal from "@/components/AdminLockPreviewModal";
import { buildStrokePreview, type HcpRules, type PreviewEntry } from "@/lib/adminResultPreview";

type PlayerRow = {
  season_player_id: string;
  person_id: string;
  name: string;
  hcp: number;
  existing_gross: number | null;
  existing_dns: boolean;
  existing_override?: number | null;
};

type StartScoreRow = {
  season_player_id: string;
  start_score: number;
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

export default function AdminFinalEventForm({
  eventId,
  eventName,
  isLocked,
  players,
  startScores,
  hcpRules,
}: {
  eventId: string;
  eventName: string;
  isLocked: boolean;
  players: PlayerRow[];
  startScores: StartScoreRow[];
  hcpRules: HcpRules;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const startMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of startScores ?? []) map.set(row.season_player_id, Number(row.start_score ?? 0));
    return map;
  }, [startScores]);

  const [rows, setRows] = useState<Entry[]>(
    players.map((player) => ({
      season_player_id: player.season_player_id,
      gross_strokes: player.existing_gross ?? null,
      did_not_play: player.existing_dns ?? false,
      override_placing: player.existing_override ?? null,
      lag_nr: null,
      lag_score: null,
    }))
  );

  const preview = useMemo(
    () =>
      buildStrokePreview(
        players.map((player) => ({
          season_player_id: player.season_player_id,
          name: player.name,
          hcp: player.hcp,
        })),
        rows,
        hcpRules,
        "final",
        startMap
      ),
    [hcpRules, players, rows, startMap]
  );

  function patch(id: string, patchValue: Partial<Entry>) {
    setRows((prev) => prev.map((row) => (row.season_player_id === id ? { ...row, ...patchValue } : row)));
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
        setMsg("Finalen är upplåst ✅");
        window.location.reload();
        return;
      }

      if (mode === "lock") {
        setMsg("Finalen är låst ✅");
        window.location.reload();
        return;
      }

      setMsg("Sparat ✅ Granska net score och placering innan du låser.");
      setBusy(false);
    } catch (error: unknown) {
      setMsg(`Fel: ${getErrorMessage(error)}`);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/70">
        <div className="text-xs uppercase tracking-[0.28em] text-white/45">Final</div>
        <p className="mt-3 leading-6">
          Mata in bruttoslag. Net score räknas automatiskt som <strong>Brutto − HCP + Start</strong>,
          och används tillsammans med särspel för att avgöra finalen.
        </p>
      </div>

      {msg && (
        <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85">
          {msg}
        </div>
      )}

      <div className="grid gap-3">
        {players.map((player) => {
          const row = rows.find((entry) => entry.season_player_id === player.season_player_id)!;
          const start = startMap.get(player.season_player_id) ?? 0;

          return (
            <div
              key={player.season_player_id}
              className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.12)]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="text-xl font-semibold tracking-tight text-white">{player.name}</div>
                  <div className="mt-1 text-sm text-white/55">
                    HCP {player.hcp.toFixed(1)} • Start {start}
                  </div>
                </div>

                <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,180px)_minmax(0,180px)_auto]">
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.24em] text-white/45">Bruttoslag</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={row.gross_strokes ?? ""}
                      disabled={busy || isLocked}
                      onChange={(e) =>
                        patch(player.season_player_id, {
                          gross_strokes: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-lg tabular-nums text-white outline-none transition focus:border-white/30"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.24em] text-white/45">Särspel</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={row.override_placing ?? ""}
                      disabled={busy || isLocked}
                      onChange={(e) =>
                        patch(player.season_player_id, {
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
                      onChange={(e) => patch(player.season_player_id, { did_not_play: e.target.checked })}
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
              <h2 className="mt-2 text-xl font-semibold text-white">Verifiera finalordningen</h2>
              <p className="mt-2 max-w-2xl text-sm text-white/60">
                Justerad score och särspel avgör pallen. Kontrollera detta innan resultatet blir officiellt.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/40">I mål</div>
                <div className="mt-2 text-2xl font-semibold text-white">{preview.playable.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/40">Ofullständiga</div>
                <div className="mt-2 text-2xl font-semibold text-white">{preview.incomplete.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/40">DNS</div>
                <div className="mt-2 text-2xl font-semibold text-white">{preview.dns.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/40">Ledare</div>
                <div className="mt-2 truncate text-lg font-semibold text-white">
                  {preview.playable[0]?.name ?? "Ingen ännu"}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {preview.rows.map((row) => (
              <div
                key={row.season_player_id}
                className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-semibold text-white">{row.name}</span>
                      {row.placing != null && (
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-100">
                          #{row.placing}
                        </span>
                      )}
                      {row.didNotPlay && (
                        <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-100">
                          DNS
                        </span>
                      )}
                      {row.incomplete && (
                        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-white/65">
                          Ej ifylld
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-white/55">
                      HCP {row.hcp.toFixed(1)} • {row.hcpStrokes} slag • Start {row.startScore ?? 0}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">Brutto</div>
                      <div className="mt-1 text-lg font-semibold text-white">{row.grossStrokes ?? "—"}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">Start</div>
                      <div className="mt-1 text-lg font-semibold text-white">{row.startScore ?? "—"}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">Net</div>
                      <div className="mt-1 text-lg font-semibold text-white">{row.adjustedScore ?? "—"}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">Placering</div>
                      <div className="mt-1 text-lg font-semibold text-white">{row.placing ?? "—"}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="rounded-[26px] border border-white/10 bg-black/20 p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Finalen sparas som utkast först</div>
            <p className="mt-1 text-sm text-white/55">
              När du låser får du en sista kontrollvy så att pallen och net score är rätt.
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
        description="Kontrollera slutordningen i finalen. När du bekräftar blir resultatet officiellt och kan skickas ut till spelarna."
        onClose={() => setPreviewOpen(false)}
        onConfirm={() => callApi("lock")}
      >
        <div className="space-y-3">
          {preview.rows.map((row) => (
            <div key={row.season_player_id} className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold text-white">{row.name}</span>
                    {row.placing != null && (
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-100">
                        #{row.placing}
                      </span>
                    )}
                    {row.didNotPlay && (
                      <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-100">
                        DNS
                      </span>
                    )}
                    {row.incomplete && (
                      <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-white/65">
                        Ej ifylld
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-white/55">
                    HCP {row.hcp.toFixed(1)} • {row.hcpStrokes} slag • Start {row.startScore ?? 0}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">Brutto</div>
                    <div className="mt-1 text-lg font-semibold text-white">{row.grossStrokes ?? "—"}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">Start</div>
                    <div className="mt-1 text-lg font-semibold text-white">{row.startScore ?? "—"}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">Net</div>
                    <div className="mt-1 text-lg font-semibold text-white">{row.adjustedScore ?? "—"}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">Placering</div>
                    <div className="mt-1 text-lg font-semibold text-white">{row.placing ?? "—"}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </AdminLockPreviewModal>
    </div>
  );
}
