"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type SeasonRow = { id: string; name: string; created_at: string; is_current: boolean };
type Winner = { name: string; avatar_url: string | null; total: number } | null;
type WinnerRow = { season_id: string; winner: Winner; label: string };

function Avatar({ url, name }: { url: string | null; name: string }) {
  return (
    <div className="h-12 w-12 overflow-hidden rounded-full border border-white/10 bg-white/5">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-lg">🏆</div>
      )}
    </div>
  );
}

function CurrentChip() {
  return (
    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
      Aktiv
    </span>
  );
}

export default function AdminSeasonsClient({
  seasons,
  winners,
}: {
  seasons: SeasonRow[];
  winners: WinnerRow[];
}) {
  const bySeason = useMemo(() => {
    const m = new Map<string, { winner: Winner; label: string }>();
    for (const w of winners) m.set(w.season_id, { winner: w.winner, label: w.label });
    return m;
  }, [winners]);

  const [name, setName] = useState("");
  const [copyFromCurrent, setCopyFromCurrent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function createSeason() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/seasons/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, copyFromCurrent }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Kunde inte skapa säsong");
      setMsg("✅ Ny säsong skapad!");
      setName("");
      window.location.reload();
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? "Fel"}`);
    } finally {
      setBusy(false);
    }
  }

  async function setCurrent(season_id: string) {
    if (!confirm("Sätta denna säsong som aktiv? Alla publika sidor kommer visa den.")) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/seasons/set-current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season_id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Kunde inte sätta aktiv säsong");
      setMsg("✅ Aktiv säsong uppdaterad!");
      window.location.reload();
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? "Fel"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Ny säsong */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs text-white/60">Ny säsong</div>
            <div className="text-sm text-white/70">
              Skapa en inaktiv säsong (t.ex. nästa år) och fyll den med spelare/tävlingar/regler.
            </div>
          </div>

          <div className="flex flex-col gap-2 md:items-end">
            <div className="flex flex-wrap gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="PostNord Cup 2026/2027"
                className="w-[260px] max-w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
              />
              <button
                disabled={busy || !name.trim()}
                onClick={createSeason}
                className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15 disabled:opacity-50"
              >
                {busy ? "Skapar..." : "Ny säsong"}
              </button>
            </div>

            <label className="flex items-center gap-2 text-xs text-white/70">
              <input type="checkbox" checked={copyFromCurrent} onChange={(e) => setCopyFromCurrent(e.target.checked)} />
              Kopiera regler &amp; poängtabell från aktiv säsong
            </label>
          </div>
        </div>

        {msg ? <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">{msg}</div> : null}
      </section>

      {/* Lista säsonger */}
      <section className="grid gap-4 md:grid-cols-2">
        {seasons.map((s) => {
          const meta = bySeason.get(s.id) ?? { winner: null, label: s.is_current ? "Ledare (serie)" : "Vinnare (Final)" };
          const winner = meta.winner;

          return (
            <div key={s.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-white/60">Säsong</div>
                    {s.is_current ? <CurrentChip /> : null}
                  </div>
                  <div className="text-xl font-semibold">{s.name}</div>

                  <div className="mt-2 text-sm text-white/60">
                    {meta.label}:{" "}
                    <span className="font-medium text-white/80">{winner?.name ?? "—"}</span>
                  </div>
                  <div className="text-xs text-white/50">
                    {winner ? `${winner.total.toLocaleString("sv-SE")} p` : ""}
                  </div>
                </div>

                <Avatar url={winner?.avatar_url ?? null} name={winner?.name ?? "—"} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setCurrent(s.id)}
                  disabled={busy || s.is_current}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
                >
                  Sätt som aktiv
                </button>

                <Link
                  href={`/admin?season=${encodeURIComponent(s.id)}`}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                >
                  Öppna i admin →
                </Link>

                <Link
                  href={`/?season=${encodeURIComponent(s.id)}`}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                >
                  Visa publikt →
                </Link>
              </div>

              <div className="mt-2 text-xs text-white/50">ID: {s.id}</div>
            </div>
          );
        })}
      </section>
    </div>
  );
}