"use client";

import { useMemo, useState } from "react";

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
  members: string[]; // season_player_id[]
};

type Entry = {
  season_player_id: string;
  gross_strokes: number | null;
  did_not_play: boolean;
  override_placing: number | null;
  lag_nr: number | null;
  lag_score: number | null;
};

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

  const [rows, setRows] = useState<Entry[]>(
    players.map((p) => ({
      season_player_id: p.season_player_id,
      gross_strokes: null, // ej använd för lag
      did_not_play: p.existing_dns ?? false,
      override_placing: (p.existing_override ?? null) as any,
      lag_nr: p.existing_lag_nr ?? null,
      lag_score: p.existing_lag_score ?? null,
    }))
  );

  // init team scores (1..6)
  const initialScoreMap = useMemo(() => {
    const m: Record<number, number | null> = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
    for (const t of initialTeams ?? []) {
      if (t?.lag_nr && t.lag_score != null) m[t.lag_nr] = t.lag_score;
    }
    // fallback: first score found from rows
    for (const r of rows) {
      if (r.lag_nr && r.lag_score != null && m[r.lag_nr] == null) m[r.lag_nr] = r.lag_score;
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [teamScore, setTeamScore] = useState<Record<number, number | null>>(initialScoreMap);

  function patchRow(id: string, patch: Partial<Entry>) {
    setRows((prev) => prev.map((r) => (r.season_player_id === id ? { ...r, ...patch } : r)));
  }

  function setTeamScoreFor(lag: number, value: number | null) {
    setTeamScore((prev) => ({ ...prev, [lag]: value }));
    // apply score to all members of that team
    setRows((prev) => prev.map((r) => (r.lag_nr === lag ? { ...r, lag_score: value } : r)));
  }

  async function callApi(mode: "save" | "lock" | "unlock") {
    setBusy(true);
    setMsg(null);

    const payload: any = { entries: rows };
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

      if (mode === "unlock") setMsg("Tävlingen är upplåst ✅");
      else if (mode === "lock") setMsg("Tävlingen är låst ✅");
      else setMsg("Sparat ✅");

      window.location.reload();
    } catch (e: any) {
      setMsg(`Fel: ${e?.message ?? "Nätverksfel"}`);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70 text-left">
        <strong>Lagtävling</strong>: välj lag (1–6) för spelare och ange ett <strong>lagbrutto</strong> per lag.
        <strong> Särspel placering</strong> kan användas som tie-break om lagresultat blir lika.
      </div>

      {msg && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
          {msg}
        </div>
      )}

      {/* Lagbrutto */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold mb-3">Lagbrutto</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((lag) => (
            <div key={lag} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <div className="text-sm text-white/80">Lag {lag}</div>
              <input
                type="number"
                value={teamScore[lag] ?? ""}
                disabled={busy || isLocked}
                onChange={(e) => setTeamScoreFor(lag, e.target.value === "" ? null : Number(e.target.value))}
                className="w-24 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-right tabular-nums focus:border-white/30 focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Spelare -> lag */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
        {players.map((p) => {
          const r = rows.find((x) => x.season_player_id === p.season_player_id)!;

          return (
            <div key={p.season_player_id} className="border-b border-white/10 px-4 py-4 last:border-b-0">
              <div className="mb-2">
                <div className="font-semibold">{p.name}</div>
                <div className="text-sm text-white/60">{p.hcp.toFixed(1)}</div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/60">Lag:</span>
                  <select
                    value={r.lag_nr ?? ""}
                    disabled={busy || isLocked}
                    onChange={(e) => {
                      const lag = e.target.value === "" ? null : Number(e.target.value);
                      patchRow(p.season_player_id, {
                        lag_nr: lag,
                        lag_score: lag ? (teamScore[lag] ?? null) : null,
                      });
                    }}
                    className="w-24 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm focus:border-white/30 focus:outline-none"
                  >
                    <option value="">—</option>
                    <option value="1">Lag 1</option>
                    <option value="2">Lag 2</option>
                    <option value="3">Lag 3</option>
                    <option value="4">Lag 4</option>
                    <option value="5">Lag 5</option>
                    <option value="6">Lag 6</option>
                  </select>

                  <label className="flex items-center gap-2 text-xs text-white/70">
                    <input
                      type="checkbox"
                      checked={r.did_not_play}
                      disabled={busy || isLocked}
                      onChange={(e) => patchRow(p.season_player_id, { did_not_play: e.target.checked })}
                    />
                    DNS
                  </label>
                </div>

                {/* Särspel placering (tie-break) */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/60">Särspel placering:</span>
                  <input
                    type="number"
                    value={r.override_placing ?? ""}
                    disabled={busy || isLocked}
                    onChange={(e) =>
                      patchRow(p.season_player_id, {
                        override_placing: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className="w-20 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm tabular-nums focus:border-white/30 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Buttons – matchar AdminEventForm */}
      <div className="flex items-center gap-4 pt-2">
        {!isLocked && (
          <button
            type="button"
            onClick={() => callApi("save")}
            disabled={busy}
            className="relative overflow-hidden rounded-xl px-7 py-2.5 text-sm font-semibold
              bg-gradient-to-br from-emerald-500/90 to-emerald-600 text-white
              shadow-lg shadow-emerald-900/30 hover:from-emerald-400 hover:to-emerald-600
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Spara
            <span className="absolute inset-0 rounded-xl ring-1 ring-white/20" />
          </button>
        )}

        <button
          type="button"
          onClick={() => callApi(isLocked ? "unlock" : "lock")}
          disabled={busy}
          className={`relative overflow-hidden rounded-xl px-7 py-2.5 text-sm font-semibold shadow-lg disabled:opacity-40 disabled:cursor-not-allowed
            ${
              isLocked
                ? "bg-gradient-to-br from-red-500/90 to-red-600 text-white shadow-red-900/30 hover:from-red-400 hover:to-red-600"
                : "bg-gradient-to-br from-slate-600/80 to-slate-700 text-white shadow-black/40 hover:from-slate-500 hover:to-slate-700"
            }`}
        >
          {isLocked ? "Lås upp" : "Lås"}
          <span className="absolute inset-0 rounded-xl ring-1 ring-white/20" />
        </button>
      </div>
    </div>
  );
}