export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";

type SeasonRow = { id: string; name: string; created_at: string; is_current?: boolean };

type EventRow = {
  id: string;
  season_id: string;
  name: string;
  event_type: string;
  starts_at: string;
  course: string | null;
  description: string | null;
  image_url: string | null;
  setting_wind: string | null;
  setting_tee_meters: number | null;
  setting_pins: string | null;
  locked: boolean;
};

function typeLabel(t: string) {
  if (t === "VANLIG") return "Vanlig";
  if (t === "MAJOR") return "Major";
  if (t === "LAGTÄVLING") return "Lagtävling";
  if (t === "FINAL") return "Final";
  return t;
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("sv-SE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function resolveSeason(sb: ReturnType<typeof supabaseServer>, requestedSeasonId: string | null) {
  if (requestedSeasonId) {
    const r = await sb.from("seasons").select("id,name,created_at,is_current").eq("id", requestedSeasonId).single();
    if (r.data) return r.data as SeasonRow;
  }

  const cur = await sb.from("seasons").select("id,name,created_at,is_current").eq("is_current", true).limit(1).single();
  if (cur.data) return cur.data as SeasonRow;

  const latest = await sb
    .from("seasons")
    .select("id,name,created_at,is_current")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return (latest.data as SeasonRow) ?? null;
}

function buildHref(base: string, seasonId: string | null, filter: string) {
  const params = new URLSearchParams();
  if (seasonId) params.set("season", seasonId);
  if (filter && filter !== "all") params.set("filter", filter);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/75">
      {children}
    </span>
  );
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; filter?: string }>;
}) {
  const sb = supabaseServer();
  const sp = await searchParams;

  const season = await resolveSeason(sb, sp?.season ?? null);
  if (!season) return <div className="text-white/70">Ingen säsong hittades.</div>;

  const filter = (sp?.filter ?? "all").toLowerCase(); // all | upcoming | played
  const seasonQuery = `?season=${encodeURIComponent(season.id)}`;

  const eventsResp = await sb
    .from("events")
    .select("id,season_id,name,event_type,starts_at,course,description,image_url,setting_wind,setting_tee_meters,setting_pins,locked")
    .eq("season_id", season.id)
    .order("starts_at", { ascending: true });

  let events = (eventsResp.data as EventRow[] | null) ?? [];

  if (filter === "upcoming") events = events.filter((e) => e.locked !== true);
  if (filter === "played") events = events.filter((e) => e.locked === true);

  const allHref = buildHref("/events", season.id, "all");
  const upcomingHref = buildHref("/events", season.id, "upcoming");
  const playedHref = buildHref("/events", season.id, "played");

  const tabClass = (active: boolean) =>
    [
      "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition border",
      active
        ? "bg-white/10 text-white border-white/20 ring-1 ring-blue-400/25"
        : "bg-white/5 text-white/75 border-white/10 hover:bg-white/8 hover:text-white",
    ].join(" ");

  return (
    <main className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="text-sm text-white/60">Tävlingar</div>
        <h1 className="mt-1 text-3xl sm:text-4xl font-semibold tracking-tight">{season.name}</h1>
        <div className="mt-2 text-white/60">Alla tävlingar för vald säsong.</div>

        {/* Filters */}
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={allHref} className={tabClass(filter === "all")}>
            Alla
          </Link>
          <Link href={upcomingHref} className={tabClass(filter === "upcoming")}>
            Kommande
          </Link>
          <Link href={playedHref} className={tabClass(filter === "played")}>
            Spelade
          </Link>
        </div>
      </section>

      {/* Grid */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {events.map((e) => (
          <Link
            key={e.id}
            href={`/events/${e.id}${seasonQuery}`}
            className="group rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition overflow-hidden"
            title="Öppna tävling"
          >
            {/* ✅ Symmetric card shell */}
            <div className="flex flex-col h-[420px]">
              {/* ✅ Fixed image box (same height, always) */}
              <div className="relative h-[220px] w-full overflow-hidden bg-black/20">
                {e.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={e.image_url}
                    alt={e.course ?? e.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white/40 text-sm">
                    Ingen bild
                  </div>
                )}

                {/* overlay */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />

                {/* badges */}
                <div className="absolute left-3 top-3 flex items-center gap-2">
                  <span className="rounded-full border border-white/15 bg-black/45 px-2 py-1 text-[11px] text-white backdrop-blur">
                    {typeLabel(e.event_type)}
                  </span>
                  <span className="rounded-full border border-white/15 bg-black/45 px-2 py-1 text-[11px] text-white backdrop-blur">
                    {e.locked ? "Spelad" : "Kommande"}
                  </span>
                </div>
              </div>

              {/* ✅ Fixed content layout */}
              <div className="flex-1 p-4 flex flex-col">
                <div className="text-xl font-semibold leading-tight line-clamp-1">{e.name}</div>

                {/* date + course (max 2 lines total) */}
                <div className="mt-2 text-sm text-white/65 leading-snug line-clamp-2">
                  {fmtDateTime(e.starts_at)} • {e.course ?? "Bana ej angiven"}
                </div>

                {/* spacer to force pills to bottom */}
                <div className="flex-1" />

                {/* Pills always present (placeholders keep symmetry) */}
                <div className="pt-4 flex flex-wrap gap-2">
                  <Pill>🌬️ {e.setting_wind ?? "—"}</Pill>
                  <Pill>⛳ {e.setting_tee_meters ?? "—"}</Pill>
                  <Pill>📍 {e.setting_pins ?? "—"}</Pill>
                </div>
              </div>
            </div>
          </Link>
        ))}

        {!events.length && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60 md:col-span-2 lg:col-span-3">
            Inga tävlingar hittades för filtret.
          </div>
        )}
      </section>
    </main>
  );
}