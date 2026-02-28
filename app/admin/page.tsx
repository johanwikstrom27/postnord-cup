export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";
import { areNotificationsPaused } from "@/lib/notificationPause";

type SeasonRow = { id: string; name: string; created_at: string };

type EventRow = { id: string; name: string; event_type: string; starts_at: string; locked: boolean };

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

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("sv-SE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function typeLabel(t: string) {
  if (t === "VANLIG") return "Vanlig";
  if (t === "MAJOR") return "Major";
  if (t === "LAGTÄVLING") return "Lagtävling";
  if (t === "FINAL") return "Final";
  return t;
}

function StatusChip({ locked }: { locked: boolean }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs ${
        locked
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          : "border-white/10 bg-white/5 text-white/70"
      }`}
    >
      {locked ? "Låst" : "Upplåst"}
    </span>
  );
}

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; notif?: string; notif_error?: string; notif_schema?: string }>;
}) {
  const sb = supabaseServer();
  const sp = await searchParams;
  const requestedSeasonId = sp?.season ?? null;

  const season = await resolveSeason(sb, requestedSeasonId);
  if (!season) return <div className="text-white/70">Ingen säsong hittades.</div>;

  const seasonQuery = `?season=${encodeURIComponent(season.id)}`;

  const eventsResp = await sb
    .from("events")
    .select("id,name,event_type,starts_at,locked")
    .eq("season_id", season.id)
    .order("starts_at", { ascending: true });

  const events = (eventsResp.data as EventRow[] | null) ?? [];
  const notificationsPaused = await areNotificationsPaused(sb);
  const toggleTarget = notificationsPaused ? "false" : "true";
  const toggleLabel = notificationsPaused ? "Slå på notiser" : "Pausa alla notiser";
  const toggleHint = notificationsPaused
    ? "Alla push-notiser är pausade globalt."
    : "Push-notiser är aktiva globalt.";
  const toggleChip = notificationsPaused ? "PAUSAD" : "AKTIV";

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-white/60">Admin</div>
            <h1 className="text-3xl font-semibold tracking-tight">Resultatinmatning</h1>
            <div className="mt-1 text-sm text-white/60">{season.name}</div>
          </div>

          <Link
            href="/"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            Till hem →
          </Link>
        </div>

        <p className="mt-4 text-sm text-white/70">
          Välj en tävling för att mata in resultat. Du kan spara, låsa och låsa upp.
        </p>

        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs text-white/60">Notiser (globalt)</div>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-1 text-xs ${
                    notificationsPaused
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  }`}
                >
                  {toggleChip}
                </span>
                <span className="text-sm text-white/80">{toggleHint}</span>
              </div>
            </div>

            <form method="POST" action="/api/admin/notifications/toggle">
              <input type="hidden" name="paused" value={toggleTarget} />
              <input type="hidden" name="next" value={`/admin${seasonQuery}`} />
              <button
                className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                  notificationsPaused
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
                }`}
              >
                {toggleLabel}
              </button>
            </form>
          </div>

          {sp?.notif === "off" && <div className="mt-3 text-xs text-amber-200">Notiser pausade.</div>}
          {sp?.notif === "on" && <div className="mt-3 text-xs text-emerald-200">Notiser aktiverade.</div>}
          {sp?.notif_error === "1" && (
            <div className="mt-3 text-xs text-red-200">Kunde inte uppdatera notisläget. Försök igen.</div>
          )}
          {sp?.notif_schema === "missing" && (
            <div className="mt-3 text-xs text-red-200">
              DB saknar kolumnen <code>seasons.notifications_paused</code>. Kör migrationen först.
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        {events.map((e) => (
          <Link
            key={e.id}
            href={`/admin/events/${e.id}${seasonQuery}`}
            className="flex items-center justify-between border-b border-white/10 px-4 py-4 hover:bg-white/5 last:border-b-0"
          >
            <div>
              <div className="font-semibold">{e.name}</div>
              <div className="text-sm text-white/60">
                {typeLabel(e.event_type)} • {fmt(e.starts_at)}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusChip locked={e.locked} />
              <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
                Mata in →
              </span>
            </div>
          </Link>
        ))}

        {events.length === 0 && (
          <div className="px-4 py-6 text-white/60">Inga tävlingar i denna säsong ännu.</div>
        )}
      </section>
    </main>
  );
}
