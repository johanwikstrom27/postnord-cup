export const runtime = "nodejs";

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";
import CoverImage from "@/components/CoverImage";

type SeasonRow = { id: string; name: string; created_at: string };
type EventRow = {
  id: string;
  name: string;
  event_type: string;
  starts_at: string;
  course: string | null;
  locked: boolean;
  image_url: string | null;
  setting_wind: string | null;
  setting_tee_meters: number | null;
  setting_pins: string | null;
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

function typeLabel(t: string) {
  if (t === "VANLIG") return "Vanlig";
  if (t === "MAJOR") return "Major";
  if (t === "LAGTÄVLING") return "Lagtävling";
  if (t === "FINAL") return "Final";
  return t;
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("sv-SE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function EventsPage({
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

  const eventsResp = await sb
    .from("events")
    .select("id,name,event_type,starts_at,course,locked,image_url,setting_wind,setting_tee_meters,setting_pins")
    .eq("season_id", season.id)
    .order("starts_at", { ascending: true });

  const events = (eventsResp.data as EventRow[] | null) ?? [];

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-white/60">Tävlingar</div>
            <h1 className="text-3xl font-semibold tracking-tight">{season.name}</h1>
          </div>
          <Link href="/" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10">
            Till hem →
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((e) => (
          <Link
            key={e.id}
            href={`/events/${e.id}${seasonQuery}`}
            className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10"
          >
            <CoverImage src={e.image_url} alt={e.course ?? e.name} />
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-white/80">
                  {typeLabel(e.event_type)}
                </span>
                <span className="text-xs text-white/60">{e.locked ? "Spelad" : "Kommande"}</span>
              </div>
              <div className="font-semibold">{e.name}</div>
              <div className="text-sm text-white/60">
                {fmtDateTime(e.starts_at)} • {e.course ?? "Bana ej angiven"}
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-white/75 pt-1">
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">🌬️ {e.setting_wind ?? "—"}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">⛳ {e.setting_tee_meters ? `${e.setting_tee_meters} m` : "—"}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">📍 {e.setting_pins ?? "—"}</span>
              </div>
            </div>
          </Link>
        ))}
      </section>

      {requestedSeasonId ? (
        <div className="text-sm text-white/70">
          <Link href="/history" className="hover:underline">← Till historik</Link>
        </div>
      ) : null}
    </main>
  );
}