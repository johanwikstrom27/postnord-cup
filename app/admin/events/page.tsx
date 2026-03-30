export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";

type SeasonRow = { id: string; name: string; created_at: string };
type EventListRow = {
  id: string;
  name: string;
  event_type: string;
  starts_at: string;
  locked: boolean;
  course: string | null;
};

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

function niceDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminEvents({
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

  const listResp = await sb
    .from("events")
    .select("id,name,event_type,starts_at,locked,course")
    .eq("season_id", season.id)
    .order("starts_at", { ascending: true });

  const events = (listResp.data ?? []) as EventListRow[];

  return (
    <main className="space-y-6">
      <section className="rounded-[30px] border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.16)] md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-white/45">Admin</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Tävlingar</h1>
            <div className="mt-2 text-sm text-white/60">{season.name}</div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={`/admin${seasonQuery}`} className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10">
              ← Resultat
            </Link>
          <Link
            href={`/admin/events/new${seasonQuery}`}
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Ny tävling →
          </Link>
          </div>
        </div>

        <p className="mt-4 max-w-2xl text-sm leading-6 text-white/68">
          Här håller du säsongens tävlingar samlade. Layouten är nu byggd för mobil först, så att du snabbt
          kan hoppa mellan redigering, resultat och borttagning även ute på banan.
        </p>
      </section>

      <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_16px_60px_rgba(0,0,0,0.14)] md:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.28em] text-white/45">Tävlingslista</div>
          <div className="text-sm text-white/55">{events.length} st</div>
        </div>

        <div className="grid gap-3">
        {events.map((e) => (
          <div
            key={e.id}
            className="rounded-[24px] border border-white/10 bg-black/20 p-4 shadow-[0_10px_40px_rgba(0,0,0,0.12)] md:p-5"
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xl font-semibold tracking-tight text-white">{e.name}</div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/75">
                  {e.event_type}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    e.locked
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                      : "border-white/10 bg-white/5 text-white/70"
                  }`}
                >
                  {e.locked ? "Låst" : "Upplåst"}
                </span>
              </div>

              <div className="grid gap-2 text-sm text-white/60 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">Start</div>
                  <div className="mt-1 text-white/80">{niceDate(e.starts_at)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 sm:col-span-2">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">Bana</div>
                  <div className="mt-1 text-white/80">{e.course ?? "Bana ej angiven"}</div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <Link
                  href={`/admin/events/${e.id}/edit${seasonQuery}`}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Redigera
                </Link>

                <Link
                  href={`/admin/events/${e.id}${seasonQuery}`}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Resultat
                </Link>

                <form method="POST" action="/api/admin/events/delete">
                  <input type="hidden" name="event_id" value={e.id} />
                  <button className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200 transition hover:bg-red-500/20">
                    Ta bort
                  </button>
                </form>
              </div>
            </div>
          </div>
        ))}
        </div>

        {events.length === 0 && (
          <div className="rounded-[24px] border border-dashed border-white/10 px-4 py-8 text-center text-white/60">
            Inga tävlingar i denna säsong ännu.
          </div>
        )}
      </section>
    </main>
  );
}
