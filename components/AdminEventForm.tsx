"use client";

import { useState } from "react";

type PlayerRow = {
  season_player_id: string;
  name: string;
  hcp: number;

  existing_gross: number | null;
  existing_dns: boolean;
  existing_override: number | null;
};

type Entry = {
  season_player_id: string;
  gross_strokes: number | null;
  did_not_play: boolean;
  override_placing: number | null;
  lag_nr: number | null;
  lag_score: number | null;
};

export default function AdminEventForm({
  eventId,
  eventType,
  locked,
  players,
}: {
  eventId: string;
  eventType: string;
  locked: boolean;
  players: PlayerRow[];
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [rows, setRows] = useState<Entry[]>(
    players.map((p) => ({
      season_player_id: p.season_player_id,
      gross_strokes: p.existing_gross ?? null,
      did_not_play: p.existing_dns ?? false,
      override_placing: p.existing_override ?? null,
      lag_nr: null,
      lag_score: null,
    }))
  );

  function patch(id: string, patch: Partial<Entry>) {
    setRows((prev) => prev.map((r) => (r.season_player_id === id ? { ...r, ...patch } : r)));
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
        <strong>DNS</strong> = spelade inte (0 poäng).{" "}
        <strong>Särspel placering</strong> används vid särspel (ex: 1,2,2 → nästa 4).
      </div>

      {msg && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
          {msg}
        </div>
      )}

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
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/60">Bruttoslag:</span>
                    <input
                      type="number"
                      value={r.gross_strokes ?? ""}
                      onChange={(e) =>
                        patch(p.season_player_id, {
                          gross_strokes: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      disabled={busy || locked}
                      className="w-20 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm tabular-nums focus:border-white/30 focus:outline-none"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs text-white/70">
                    <input
                      type="checkbox"
                      checked={r.did_not_play}
                      onChange={(e) => patch(p.season_player_id, { did_not_play: e.target.checked })}
                      disabled={busy || locked}
                    />
                    DNS
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/60">Särspel placering:</span>
                  <input
                    type="number"
                    value={r.override_placing ?? ""}
                    onChange={(e) =>
                      patch(p.season_player_id, {
                        override_placing: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    disabled={busy || locked}
                    className="w-20 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm tabular-nums focus:border-white/30 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 pt-2">
        {!locked && (
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
          onClick={() => callApi(locked ? "unlock" : "lock")}
          disabled={busy}
          className={`relative overflow-hidden rounded-xl px-7 py-2.5 text-sm font-semibold shadow-lg disabled:opacity-40 disabled:cursor-not-allowed
            ${
              locked
                ? "bg-gradient-to-br from-red-500/90 to-red-600 text-white shadow-red-900/30 hover:from-red-400 hover:to-red-600"
                : "bg-gradient-to-br from-slate-600/80 to-slate-700 text-white shadow-black/40 hover:from-slate-500 hover:to-slate-700"
            }`}
        >
          {locked ? "Lås upp" : "Lås"}
          <span className="absolute inset-0 rounded-xl ring-1 ring-white/20" />
        </button>
      </div>
    </div>
  );
}