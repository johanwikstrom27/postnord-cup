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
      <section className="rounded-[30px] border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.16)] backdrop-blur md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-white/45">Admin</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Resultatinmatning</h1>
            <div className="mt-2 text-sm text-white/60">{season.name}</div>
          </div>

          <Link
            href="/"
            className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium transition hover:bg-white/10 sm:w-auto"
          >
            Till hem →
          </Link>
        </div>

        <p className="mt-4 max-w-2xl text-sm leading-6 text-white/68">
          Välj en tävling för att mata in resultat. Resultat kan nu sparas som utkast och förhandsgranskas
          innan låsning, så att placeringar och notiser blir rätt direkt.
        </p>

        <div className="mt-5 rounded-[24px] border border-white/10 bg-black/20 p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Notiser</div>
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
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
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

      <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_16px_60px_rgba(0,0,0,0.14)] md:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-white/45">Tävlingar</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Välj tävling att jobba med</h2>
          </div>
          <Link
            href={`/admin/events${seasonQuery}`}
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Hantera tävlingar →
          </Link>
          <Link
            href="/admin/other-competitions"
            className="inline-flex items-center justify-center rounded-2xl border border-sky-300/20 bg-sky-400/10 px-4 py-3 text-sm font-medium text-sky-100 transition hover:bg-sky-400/15"
          >
            Andra tävlingar →
          </Link>
        </div>

        <div className="grid gap-3">
        {events.map((e) => (
          <Link
            key={e.id}
            href={`/admin/events/${e.id}${seasonQuery}`}
            className="rounded-[24px] border border-white/10 bg-black/20 p-4 transition hover:bg-white/[0.06] md:p-5"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-xl font-semibold tracking-tight text-white">{e.name}</div>
                  <StatusChip locked={e.locked} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-sm text-white/60">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                    {typeLabel(e.event_type)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{fmt(e.starts_at)}</span>
                </div>
              </div>

              <span className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/85 transition hover:bg-white/10">
                Mata in →
              </span>
            </div>
          </Link>
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
