export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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

  const events = (listResp.data ?? []) as any[];

  return (
    <main className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-sm text-white/60">Admin</div>
          <h1 className="text-2xl font-semibold">Tävlingar</h1>
          <div className="text-sm text-white/60">{season.name}</div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/admin/events/new${seasonQuery}`}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10"
          >
            Ny tävling →
          </Link>

          <Link href={`/admin${seasonQuery}`} className="text-sm text-white/70 hover:underline">
            ← Resultat
          </Link>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        {events.map((e: any) => (
          <div
            key={e.id}
            className="flex items-center justify-between border-b border-white/10 px-4 py-4 last:border-b-0"
          >
            <div>
              <div className="font-semibold">{e.name}</div>
              <div className="text-sm text-white/60">
                {e.event_type} • {niceDate(e.starts_at)} • {e.course ?? "Bana ej angiven"} •{" "}
                {e.locked ? "Låst" : "Upplåst"}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/admin/events/${e.id}/edit${seasonQuery}`}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
              >
                Redigera
              </Link>

              <Link
                href={`/admin/events/${e.id}${seasonQuery}`}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
              >
                Resultat
              </Link>

              <form method="POST" action="/api/admin/events/delete">
                <input type="hidden" name="event_id" value={e.id} />
                <button className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200 hover:bg-red-500/20">
                  Ta bort
                </button>
              </form>
            </div>
          </div>
        ))}

        {events.length === 0 && (
          <div className="px-4 py-6 text-white/60">Inga tävlingar i denna säsong ännu.</div>
        )}
      </section>
    </main>
  );
}