export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";

type SeasonRow = { id: string; name: string; created_at: string };

type EventRow = {
  id: string;
  season_id: string;
  name: string;
  event_type: string;
  starts_at: string;
  course: string | null;
  image_url: string | null;
  setting_wind: string | null;
  setting_tee_meters: number | null;
  setting_pins: string | null;
  locked: boolean;
};

type WinnerRow = {
  event_id: string;
  season_players: { person_id: string; people: { name: string; avatar_url: string | null } | null } | null;
};

function typeLabel(t: string) {
  if (t === "VANLIG") return "Vanlig";
  if (t === "MAJOR") return "Major";
  if (t === "LAGTÄVLING") return "Lagtävling";
  if (t === "FINAL") return "Final";
  return t;
}

function iconForType(t: string) {
  if (t === "FINAL") return "/icons/final-1.png";
  if (t === "MAJOR") return "/icons/major-1.png";
  if (t === "LAGTÄVLING") return "/icons/lagtavling-1.png";
  return "/icons/vanlig-1.png";
}

function fmtDateWithYear(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/75">
      {children}
    </span>
  );
}

function AvatarTiny({ url, name }: { url: string | null; name: string }) {
  return (
    <div className="h-6 w-6 overflow-hidden rounded-full border border-white/10 bg-white/5 shrink-0">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px]">⛳</div>
      )}
    </div>
  );
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  const dash = c * pct;

  return (
    <div className="flex items-center gap-3">
      <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0">
        <circle cx="20" cy="20" r={r} stroke="rgba(255,255,255,0.12)" strokeWidth="4" fill="none" />
        <circle
          cx="20"
          cy="20"
          r={r}
          stroke="rgba(120,190,255,0.9)"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform="rotate(-90 20 20)"
        />
      </svg>

      <div className="leading-tight">
        <div className="text-xs text-white/60">Säsong progress</div>
        <div className="text-sm font-semibold">
          Spelade {done}/{total}
        </div>
      </div>
    </div>
  );
}

async function resolveSeason(sb: ReturnType<typeof supabaseServer>, requestedSeasonId: string | null) {
  if (requestedSeasonId) {
    const r = await sb.from("seasons").select("id,name,created_at").eq("id", requestedSeasonId).single();
    const s = (r.data as SeasonRow | null) ?? null;
    if (s) return s;
  }

  const cur = await sb.from("seasons").select("id,name,created_at").eq("is_current", true).limit(1).single();
  let season = (cur.data as SeasonRow | null) ?? null;

  if (!season) {
    const latest = await sb
      .from("seasons")
      .select("id,name,created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    season = (latest.data as SeasonRow | null) ?? null;
  }

  return season;
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const sp = await searchParams;
  const sb = supabaseServer();

  const season = await resolveSeason(sb, sp?.season ?? null);
  if (!season) return <div className="text-white/70">Ingen säsong hittades.</div>;

  const seasonQuery = `?season=${encodeURIComponent(season.id)}`;

  const eventsResp = await sb
    .from("events")
    .select("id,season_id,name,event_type,starts_at,course,image_url,setting_wind,setting_tee_meters,setting_pins,locked")
    .eq("season_id", season.id)
    .order("starts_at", { ascending: true });

  const events = (eventsResp.data as EventRow[] | null) ?? [];

  const totalCount = events.length;
  const doneCount = events.filter((e) => e.locked).length;
  const nextUp = events.find((e) => !e.locked) ?? null;

  // winners for locked events (placering 1)
  const lockedIds = events.filter((e) => e.locked).map((e) => e.id);
  const winnerByEvent = new Map<string, { person_id: string; name: string; avatar_url: string | null }>();

  if (lockedIds.length) {
    const wResp = await sb
      .from("results")
      .select("event_id, season_players(person_id, people(name, avatar_url))")
      .in("event_id", lockedIds)
      .eq("placering", 1);

    const rows = (wResp.data ?? []) as any as WinnerRow[];
    for (const r of rows as any[]) {
      const eventId = String(r.event_id);
      const spx = r.season_players;
      const person_id = spx?.person_id ? String(spx.person_id) : "";
      const name = spx?.people?.name ? String(spx.people.name) : "";
      const avatar_url = (spx?.people?.avatar_url as string | null) ?? null;
      if (eventId && person_id && name && !winnerByEvent.has(eventId)) {
        winnerByEvent.set(eventId, { person_id, name, avatar_url });
      }
    }
  }

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm text-white/60">Säsongsöverblick</div>
            <h1 className="mt-1 text-3xl sm:text-4xl font-semibold tracking-tight">{season.name}</h1>
            <div className="mt-2 text-white/60">Scrolla tidslinjen för hela säsongen.</div>
          </div>

          <ProgressRing done={doneCount} total={totalCount} />
        </div>
      </section>

      {/* Timeline */}
      <section className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-[2px] bg-white/10 rounded-full" />

        <div className="space-y-5">
          {events.map((e) => {
            const isNext = nextUp?.id === e.id;
            const isPlayed = e.locked;

            const icon = iconForType(e.event_type);
            const winner = isPlayed ? winnerByEvent.get(e.id) ?? null : null;

            return (
              <Link
                key={e.id}
                href={`/events/${e.id}${seasonQuery}`}
                className={[
                  "group relative block rounded-2xl border border-white/10 bg-white/5 backdrop-blur transition",
                  "pl-16 pr-5 py-4 overflow-hidden",
                  isPlayed ? "opacity-90" : "",
                  isNext
                    ? "ring-1 ring-blue-400/45 shadow-[0_0_34px_rgba(80,140,255,0.35)] bg-white/7"
                    : "hover:bg-white/10",
                ].join(" ")}
                title="Öppna tävling"
              >
                {/* Background course image 10% */}
                {e.image_url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={e.image_url}
                      alt=""
                      className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.10]"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/35 via-black/10 to-black/25" />
                  </>
                ) : null}

                {/* node + pulsing dot */}
                <div className="absolute left-[18px] top-6">
                  <div
                    className={[
                      "h-4 w-4 rounded-full border border-white/20 bg-black/40",
                      isPlayed ? "bg-emerald-500/20 border-emerald-400/40" : "",
                      isNext ? "border-blue-400/60 bg-blue-400/20" : "",
                    ].join(" ")}
                  />
                  {isNext ? (
                    <div className="absolute -inset-2 rounded-full border border-blue-400/40 animate-ping" />
                  ) : null}
                </div>

                {/* Big icon */}
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <div className={isNext ? "h-16 w-16" : "h-14 w-14"}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={icon}
                      alt={typeLabel(e.event_type)}
                      className={[
                        "h-full w-full object-contain drop-shadow",
                        "transition-transform duration-150",
                        isNext ? "animate-[pulse_2s_ease-in-out_infinite]" : "",
                        "group-hover:scale-[1.06]",
                      ].join(" ")}
                      style={
                        isNext
                          ? {
                              filter: "drop-shadow(0 0 14px rgba(100,170,255,0.55))",
                            }
                          : undefined
                      }
                    />
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-col gap-2 relative">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {/* 👇 Byt namn -> typ */}
                      <div className="flex items-center gap-2">
                        <div className="text-[11px] text-white/65">
                          {typeLabel(e.event_type)}
                        </div>

                        {isNext ? (
                          <span className="rounded-full border border-blue-400/30 bg-blue-400/10 px-2 py-0.5 text-[11px] text-blue-200">
                            Nästa
                          </span>
                        ) : null}
                      </div>

                      {/* Course (no truncation) */}
                      <div className="mt-1 font-semibold text-lg leading-snug break-words">
                        {e.course ?? "Bana ej angiven"}
                      </div>

                      <div className="mt-1 text-sm text-white/60">
                        {fmtDateWithYear(e.starts_at)} • {fmtTime(e.starts_at)}
                      </div>
                    </div>

                    {/* Right side: if NOT locked -> show badge here */}
                    {!isPlayed ? (
                      <span className="rounded-full border border-white/15 bg-black/40 px-2 py-1 text-[11px] text-white/80 backdrop-blur shrink-0">
                        Kommande
                      </span>
                    ) : (
                      <div className="shrink-0" />
                    )}
                  </div>

                  {/* Winner (locked) */}
                  {winner ? (
                    <div className="mt-1 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🥇</span>
                        <AvatarTiny url={winner.avatar_url} name={winner.name} />
                        <span className="text-sm text-white/85 truncate">{winner.name}</span>
                      </div>

                      {/* Spelad badge UNDER winner */}
                      <div>
                        <span className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-200">
                          ✓ Spelad
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {/* settings */}
                  <div className="flex flex-wrap gap-2">
                    <Pill>🌬️ {e.setting_wind ?? "—"}</Pill>
                    <Pill>⛳ {e.setting_tee_meters ?? "—"}</Pill>
                    <Pill>📍 {e.setting_pins ?? "—"}</Pill>
                  </div>
                </div>
              </Link>
            );
          })}

          {!events.length ? <div className="text-white/70">Inga tävlingar hittades för säsongen.</div> : null}
        </div>
      </section>
    </main>
  );
}