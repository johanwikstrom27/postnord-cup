export const runtime = "nodejs";

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";

type SeasonRow = { id: string; name: string; created_at: string };
type PersonRow = { id: string; name: string; avatar_url: string | null };

async function resolveSeason(sb: ReturnType<typeof supabaseServer>, requestedSeasonId: string | null) {
  if (requestedSeasonId) {
    const r = await sb.from("seasons").select("id,name,created_at").eq("id", requestedSeasonId).single();
    const s = (r.data as SeasonRow | null) ?? null;
    if (s) return s;
  }

  const cur = await sb.from("seasons").select("id,name,created_at").eq("is_current", true).limit(1).single();
  let season = (cur.data as SeasonRow | null) ?? null;

  if (!season) {
    const latest = await sb.from("seasons").select("id,name,created_at").order("created_at", { ascending: false }).limit(1).single();
    season = (latest.data as SeasonRow | null) ?? null;
  }

  return season;
}

export default async function AdminSeasonPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const sb = supabaseServer();
  const sp = await searchParams;
  const requestedSeasonId = sp?.season ?? null;

  const season = await resolveSeason(sb, requestedSeasonId);
  if (!season) return <div className="text-white/70">Ingen säsong hittades.</div>;

  const seasonQuery = `?season=${encodeURIComponent(season.id)}`;

  // people
  const peopleResp = await sb
    .from("people")
    .select("id,name,avatar_url")
    .order("name", { ascending: true });

  const people = (peopleResp.data as PersonRow[] | null) ?? [];

  // season_players
  const listResp = await sb
    .from("season_players")
    .select("id,hcp,people(id,name,avatar_url)")
    .eq("season_id", season.id)
    .order("created_at", { ascending: true });

  const rows = (listResp.data ?? []) as any[];

  return (
    <main className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-sm text-white/60">Admin</div>
          <h1 className="text-2xl font-semibold">Säsongsspelare</h1>
          <div className="text-sm text-white/60">{season.name}</div>
        </div>
        <Link href={`/admin${seasonQuery}`} className="text-sm text-white/70 hover:underline">
          ← Resultat
        </Link>
      </div>

      {/* ✅ NYTT: Kopiera från förra säsongen */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="font-semibold">Snabbåtgärder</h2>
        <p className="mt-2 text-sm text-white/70">
          Kopierar spelare + HCP från föregående säsong till denna säsong. Skapar endast de som saknas (skriver inte över befintliga).
        </p>

        <form className="mt-4" method="POST" action="/api/admin/players/copy-prev">
          <input type="hidden" name="season_id" value={season.id} />
          <button className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold hover:bg-white/10">
            Kopiera från förra säsongen →
          </button>
        </form>
      </section>

      {/* 1) Lägg till befintlig */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="font-semibold">Lägg till befintlig spelare i säsong</h2>
        <div className="mt-2 text-sm text-white/70">
          Välj spelare från listan. Profilen följer spelaren över alla säsonger – endast HCP ändras per säsong.
        </div>

        <form className="mt-4 grid gap-3 md:grid-cols-3" method="POST" action="/api/admin/players/add-existing">
          <input type="hidden" name="season_id" value={season.id} />

          <select
            name="person_id"
            className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
            required
            defaultValue=""
          >
            <option value="" disabled>
              Välj spelare…
            </option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <input
            name="hcp"
            placeholder="HCP (ex 12.9)"
            className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
            required
          />

          <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-semibold hover:bg-white/10">
            Lägg till
          </button>
        </form>
      </section>

      {/* 2) Skapa ny + lägg till */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="font-semibold">Skapa ny spelare</h2>
        <div className="mt-2 text-sm text-white/70">
          Om spelaren inte finns i listan ännu: skapa personen (profilen) och lägg direkt till i denna säsong.
        </div>

        <form className="mt-4 grid gap-3 md:grid-cols-4" method="POST" action="/api/admin/people/create-simple">
          <input type="hidden" name="season_id" value={season.id} />

          <input
            name="name"
            placeholder="Namn"
            className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
            required
          />

          <input
            name="avatar_url"
            placeholder="Avatar URL (valfritt)"
            className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
          />

          <input
            name="hcp"
            placeholder="HCP (ex 12.9)"
            className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
            required
          />

          <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-semibold hover:bg-white/10">
            Skapa & lägg till
          </button>
        </form>
      </section>

      {/* Lista */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        {rows.map((r: any) => (
          <div
            key={r.id}
            className="flex flex-col gap-3 border-b border-white/10 px-4 py-4 last:border-b-0 md:flex-row md:items-center md:justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-white/5">
                {r.people?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.people.avatar_url} alt={r.people?.name ?? "Spelare"} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm">⛳</div>
                )}
              </div>

              <div>
                <div className="font-semibold">{r.people?.name ?? "Okänd"}</div>
                <div className="text-xs text-white/60">Person-id: {r.people?.id ?? "—"}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <form method="POST" action="/api/admin/players/update-hcp" className="flex items-center gap-2">
                <input type="hidden" name="season_player_id" value={r.id} />
                <input type="hidden" name="season_id" value={season.id} />
                <input
                  name="hcp"
                  defaultValue={Number(r.hcp).toFixed(1)}
                  className="w-28 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
                />
                <button className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
                  Spara HCP
                </button>
              </form>

              <form method="POST" action="/api/admin/players/remove">
                <input type="hidden" name="season_player_id" value={r.id} />
                <input type="hidden" name="season_id" value={season.id} />
                <button className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 hover:bg-red-500/20">
                  Ta bort
                </button>
              </form>

              <Link
                href={`/admin/people/${r.people?.id ?? ""}`}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
              >
                Profil →
              </Link>
            </div>
          </div>
        ))}

        {rows.length === 0 && (
          <div className="px-4 py-6 text-white/60">Inga spelare i säsongen ännu.</div>
        )}
      </section>
    </main>
  );
}