export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";

/* ===========================
   Types
=========================== */
type SeasonRow = { id: string; name: string; created_at: string; is_current: boolean };
type RulesRow = { vanlig_best_of: number; major_best_of: number; lagtavling_best_of: number };

type SPRow = {
  id: string;
  person_id: string;
  people: { name: string; avatar_url: string | null } | null;
};

type EventRow = { id: string; event_type: string; locked: boolean };
type ResRow = { season_player_id: string; event_id: string; poang: number; did_not_play: boolean };

/* ===========================
   Helpers
=========================== */
function sumTopN(values: number[], n: number) {
  return values
    .slice()
    .sort((a, b) => b - a)
    .slice(0, n)
    .reduce((acc, v) => acc + v, 0);
}

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

async function computeWinner(sb: ReturnType<typeof supabaseServer>, seasonId: string) {
  const rulesResp = await sb
    .from("season_rules")
    .select("vanlig_best_of,major_best_of,lagtavling_best_of")
    .eq("season_id", seasonId)
    .single();

  const rules =
    (rulesResp.data as RulesRow | null) ?? ({
      vanlig_best_of: 4,
      major_best_of: 3,
      lagtavling_best_of: 2,
    } as RulesRow);

  const spResp = await sb
    .from("season_players")
    .select("id, person_id, people(name, avatar_url)")
    .eq("season_id", seasonId);

  const sps = (spResp.data ?? []) as any[] as SPRow[];
  if (!sps.length) return null;

  const spIds = sps.map((x) => x.id);

  const evResp = await sb.from("events").select("id,event_type,locked").eq("season_id", seasonId);
  const events = (evResp.data ?? []) as any[] as EventRow[];

  const lockedEventIds = events.filter((e) => e.locked).map((e) => e.id);
  if (!lockedEventIds.length) return { name: "—", avatar_url: null, total: 0 };

  const typeByEvent = new Map<string, string>();
  for (const e of events) typeByEvent.set(e.id, e.event_type);

  const resResp = await sb
    .from("results")
    .select("season_player_id,event_id,poang,did_not_play")
    .in("event_id", lockedEventIds)
    .in("season_player_id", spIds);

  const results = (resResp.data ?? []) as any[] as ResRow[];

  const bySp = new Map<string, { vanlig: number[]; major: number[]; lag: number[] }>();
  for (const id of spIds) bySp.set(id, { vanlig: [], major: [], lag: [] });

  for (const r of results) {
    if (r.did_not_play) continue;
    const t = typeByEvent.get(r.event_id);
    const b = bySp.get(r.season_player_id);
    if (!t || !b) continue;

    if (t === "VANLIG") b.vanlig.push(Number(r.poang ?? 0));
    else if (t === "MAJOR") b.major.push(Number(r.poang ?? 0));
    else if (t === "LAGTÄVLING") b.lag.push(Number(r.poang ?? 0));
  }

  const totals = sps.map((sp) => {
    const b = bySp.get(sp.id)!;
    const total =
      sumTopN(b.vanlig, rules.vanlig_best_of) +
      sumTopN(b.major, rules.major_best_of) +
      sumTopN(b.lag, rules.lagtavling_best_of);

    return {
      person_id: sp.person_id,
      name: sp.people?.name ?? "Okänd",
      avatar_url: sp.people?.avatar_url ?? null,
      total,
    };
  });

  totals.sort((a, b) => b.total - a.total);
  return totals[0];
}

/* ===========================
   Client actions (inline)
   - Create season
   - Set current
=========================== */
function AdminSeasonsActions() {
  "use client";

  const [name, setName] = (require("react") as typeof import("react")).useState("");
  const [copy, setCopy] = (require("react") as typeof import("react")).useState(true);
  const [busy, setBusy] = (require("react") as typeof import("react")).useState(false);
  const [msg, setMsg] = (require("react") as typeof import("react")).useState<string | null>(null);

  async function createSeason() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/seasons/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, copyFromCurrent: copy }),
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
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs text-white/60">Ny säsong</div>
          <div className="text-sm text-white/70">Skapa en inaktiv säsong (t.ex. nästa år) och fyll med data.</div>
        </div>

        <div className="flex flex-col gap-2 md:items-end">
          <div className="flex flex-wrap gap-2">
            <input
              value={name}
              onChange={(e: any) => setName(e.target.value)}
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
            <input type="checkbox" checked={copy} onChange={(e: any) => setCopy(e.target.checked)} />
            Kopiera regler &amp; poängtabell från aktiv säsong
          </label>
        </div>
      </div>

      {msg ? <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">{msg}</div> : null}

      {/* Expose setter function via window so server page can call easily */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.__pn_set_current_season = async function(season_id) {
              const btn = document.getElementById("pn-set-current-btn-"+season_id);
              if (btn) btn.setAttribute("disabled","true");
              try {
                const res = await fetch("/api/admin/seasons/set-current", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ season_id })
                });
                const j = await res.json();
                if (!res.ok) throw new Error(j?.error || "Kunde inte sätta aktiv säsong");
                window.location.reload();
              } catch(e) {
                alert(e.message || "Fel");
                if (btn) btn.removeAttribute("disabled");
              }
            };
          `,
        }}
      />
    </section>
  );
}

/* ===========================
   Page
=========================== */
export default async function AdminSeasonsPage() {
  const sb = supabaseServer();

  const seasonsResp = await sb
    .from("seasons")
    .select("id,name,created_at,is_current")
    .order("created_at", { ascending: false });

  const seasons = (seasonsResp.data as SeasonRow[] | null) ?? [];

  return (
    <main className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-sm text-white/60">Admin</div>
          <h1 className="text-2xl font-semibold">Säsonger</h1>
          <div className="text-sm text-white/60">Skapa nästa säsong som inaktiv och byt aktiv när det är dags.</div>
        </div>
        <Link href="/admin" className="text-sm text-white/70 hover:underline">
          ← Admin
        </Link>
      </div>

      {/* ✅ NEW: Create season UI */}
      <AdminSeasonsActions />

      <section className="grid gap-4 md:grid-cols-2">
        {await Promise.all(
          seasons.map(async (s) => {
            const winner = await computeWinner(sb, s.id);

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
                      Vinnare: <span className="font-medium text-white/80">{winner?.name ?? "—"}</span>
                    </div>
                    <div className="text-xs text-white/50">{winner ? `${winner.total.toLocaleString("sv-SE")} p` : ""}</div>
                  </div>

                  <Avatar url={winner?.avatar_url ?? null} name={winner?.name ?? "—"} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {/* ✅ FIX: set-current via API JSON */}
                  <button
                    id={`pn-set-current-btn-${s.id}`}
                    onClick={() => (globalThis as any).__pn_set_current_season?.(s.id)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
                    disabled={s.is_current}
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
          })
        )}
      </section>
    </main>
  );
}