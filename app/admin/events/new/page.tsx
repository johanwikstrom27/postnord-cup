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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={`/admin/events${seasonQuery}`}
          className="inline-flex items-center gap-2 text-sm text-white/70 transition hover:text-white"
        >
          <span>←</span>
          <span>Till tävlingar</span>
        </Link>
        <Link
          href={`/admin${seasonQuery}`}
          className="inline-flex items-center gap-2 text-sm text-white/70 transition hover:text-white"
        >
          <span>Admin</span>
          <span>→</span>
        </Link>
      </div>

      <section className="rounded-[30px] border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.16)] md:p-6">
        <div className="text-xs uppercase tracking-[0.28em] text-white/45">Ny tävling</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{season.name}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-white/65">
          Skapa nästa tävling med tydliga grundinställningar direkt från mobilen. Fälten är grupperade för
          att vara snabba att fylla i, men ändå lätta att dubbelkolla innan du sparar.
        </p>

        <form className="mt-6 space-y-6" method="POST" action="/api/admin/events/create">
          <input type="hidden" name="season_id" value={season.id} />

          <div className="rounded-[26px] border border-white/10 bg-black/20 p-4 md:p-5">
            <div className="mb-4 text-xs uppercase tracking-[0.26em] text-white/45">Grundinfo</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.24em] text-white/45">Namn</div>
              <input
                name="name"
                placeholder="ex: Tävling 2"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-white/30"
                required
              />
              </div>

              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.24em] text-white/45">Typ</div>
              <select
                name="event_type"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-white/30"
                defaultValue="VANLIG"
              >
                <option value="VANLIG">Vanlig</option>
                <option value="MAJOR">Major</option>
                <option value="LAGTÄVLING">Lagtävling</option>
                <option value="FINAL">Final</option>
              </select>
              </div>

              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.24em] text-white/45">Datum & tid</div>
              <input
                type="datetime-local"
                name="starts_at_local"
                defaultValue={toLocalDefault()}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-white/30"
                required
              />
                <div className="mt-2 text-xs text-white/45">Sparas i UTC i databasen.</div>
              </div>

              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.24em] text-white/45">Bana</div>
              <input
                name="course"
                placeholder="ex: Troxhammar GK"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-white/30"
              />
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-black/20 p-4 md:p-5">
            <div className="mb-4 text-xs uppercase tracking-[0.26em] text-white/45">Media & settings</div>
            <div>
              <div className="mb-2 text-xs uppercase tracking-[0.24em] text-white/45">Bild-URL</div>
            <input
              name="image_url"
              placeholder="https://..."
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-white/30"
            />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.24em] text-white/45">Vind</div>
              <input
                name="setting_wind"
                placeholder="Breezy / Windy"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-white/30"
              />
              </div>
              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.24em] text-white/45">Tee (meter)</div>
              <input
                name="setting_tee_meters"
                type="number"
                placeholder="5800"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-white/30"
              />
              </div>
              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.24em] text-white/45">Pins</div>
              <input
                name="setting_pins"
                placeholder="Easy / Medium / Hard"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-white/30"
              />
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-black/20 p-4 md:p-5">
            <div className="mb-4 text-xs uppercase tracking-[0.26em] text-white/45">Beskrivning</div>
            <textarea
              name="description"
              placeholder="Kort beskrivning av tävlingen..."
              className="min-h-[140px] w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-white/30"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Link
              href={`/admin/events${seasonQuery}`}
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Avbryt
            </Link>
            <button className="rounded-2xl border border-white/10 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/12">
              Skapa tävling
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
