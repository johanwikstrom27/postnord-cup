export const runtime = "nodejs";

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";

type SeasonRow = { id: string; name: string; created_at: string };

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

function toLocalDefault() {
  // Nu + 7 dagar som default
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function AdminNewEventPage({
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

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href={`/admin/events${seasonQuery}`} className="text-sm text-white/70 hover:underline">
          ← Till tävlingar
        </Link>
        <Link href={`/admin${seasonQuery}`} className="text-sm text-white/70 hover:underline">
          Admin →
        </Link>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm text-white/60">Ny tävling</div>
        <h1 className="text-2xl font-semibold">{season.name}</h1>

        <form className="mt-6 space-y-6" method="POST" action="/api/admin/events/create">
          <input type="hidden" name="season_id" value={season.id} />

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs text-white/60 mb-1">Namn</div>
              <input
                name="name"
                placeholder="ex: Tävling 2"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                required
              />
            </div>

            <div>
              <div className="text-xs text-white/60 mb-1">Typ</div>
              <select
                name="event_type"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                defaultValue="VANLIG"
              >
                <option value="VANLIG">Vanlig</option>
                <option value="MAJOR">Major</option>
                <option value="LAGTÄVLING">Lagtävling</option>
                <option value="FINAL">Final</option>
              </select>
            </div>

            <div>
              <div className="text-xs text-white/60 mb-1">Datum & tid</div>
              <input
                type="datetime-local"
                name="starts_at_local"
                defaultValue={toLocalDefault()}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                required
              />
              <div className="mt-1 text-xs text-white/50">Sparas i UTC i databasen.</div>
            </div>

            <div>
              <div className="text-xs text-white/60 mb-1">Bana</div>
              <input
                name="course"
                placeholder="ex: Troxhammar GK"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
            </div>
          </div>

          <div>
            <div className="text-xs text-white/60 mb-1">Bild-URL</div>
            <input
              name="image_url"
              placeholder="https://..."
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-xs text-white/60 mb-1">Vind</div>
              <input
                name="setting_wind"
                placeholder="Breezy / Windy"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
            </div>
            <div>
              <div className="text-xs text-white/60 mb-1">Tee (meter)</div>
              <input
                name="setting_tee_meters"
                type="number"
                placeholder="5800"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
            </div>
            <div>
              <div className="text-xs text-white/60 mb-1">Pins</div>
              <input
                name="setting_pins"
                placeholder="Easy / Medium / Hard"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
            </div>
          </div>

          <div>
            <div className="text-xs text-white/60 mb-1">Beskrivning</div>
            <textarea
              name="description"
              placeholder="Kort beskrivning av tävlingen..."
              className="min-h-[120px] w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
            />
          </div>

          <button className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold hover:bg-white/10">
            Skapa tävling
          </button>
        </form>
      </section>
    </main>
  );
}