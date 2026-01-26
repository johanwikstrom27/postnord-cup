export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";

/* ===========================
   Justera loggstorlek här
   (endast dessa två rader)
=========================== */
const LOGO_MOBILE = 72;  // px
const LOGO_DESKTOP = 92; // px

/* ===========================
   Types
=========================== */
type SeasonRow = { id: string; name: string; created_at?: string };

type RulesRow = {
  vanlig_best_of: number;
  major_best_of: number;
  lagtavling_best_of: number;
};

type SeasonPlayerRow = {
  id: string;
  person_id: string;
  hcp: number;
  people: { name: string; avatar_url: string | null } | null;
};

type EventRow = {
  id: string;
  season_id: string;
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

type ResRow = {
  season_player_id: string;
  event_id: string;
  poang: number | null;
  did_not_play: boolean;
};

type TopRow = {
  placering: number | null;
  poang: number | null;
  gross_strokes: number | null;
  net_strokes: number | null;
  adjusted_score: number | null;
  season_players: {
    person_id: string;
    people: { name: string; avatar_url: string | null } | null;
  } | null;
};

/* ===========================
   Helpers
=========================== */
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

function fmtDateShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
}

function sumTopN(values: number[], n: number) {
  return values
    .slice()
    .sort((a, b) => b - a)
    .slice(0, n)
    .reduce((acc, v) => acc + v, 0);
}

function daysUntil(iso: string) {
  const now = new Date();
  const target = new Date(iso);
  const ms = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function medalForPlacing(placing: number | null) {
  if (placing === 1) return "🥇";
  if (placing === 2) return "🥈";
  if (placing === 3) return "🥉";
  return "🏅";
}

function AvatarRound({ url, name, size = 44 }: { url: string | null; name: string; size?: number }) {
  return (
    <div
      className="overflow-hidden rounded-full border border-white/10 bg-white/5 shrink-0"
      style={{ width: size, height: size }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs">⛳</div>
      )}
    </div>
  );
}

function Thumb({ url, alt }: { url: string | null; alt: string }) {
  return (
    <div className="h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-white/5 shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url ?? "/icons/pncuplogga.png"} alt={alt} className="h-full w-full object-cover" />
    </div>
  );
}

function MiniCard({
  href,
  kicker,
  title,
  sub,
  thumb,
  children,
}: {
  href: string;
  kicker: string;
  title: string;
  sub?: string | null;
  thumb: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-white/10 bg-black/20 hover:bg-black/30 transition"
      title={title}
    >
      <div className="flex h-[120px] items-stretch gap-4 p-4">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] text-white/60">{kicker}</div>
          <div className="mt-1 text-sm font-semibold leading-snug overflow-hidden">
            {title}
          </div>
          {sub ? <div className="mt-1 text-[10px] text-white/60 truncate">{sub}</div> : null}
          {children ? <div className="mt-2">{children}</div> : null}
        </div>
        <div className="flex items-center">{thumb}</div>
      </div>
    </Link>
  );
}

function NextEventBig({ event, seasonQuery }: { event: EventRow | null; seasonQuery: string }) {
  if (!event) {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 text-white/60">
        Ingen kommande tävling inlagd.
      </div>
    );
  }

  return (
    <Link
      href={`/events/${event.id}${seasonQuery}`}
      className="block overflow-hidden rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
      title="Öppna tävling"
    >
      <div className="relative h-52 sm:h-56 w-full overflow-hidden bg-black/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={event.image_url ?? "/icons/pncuplogga.png"} alt={event.name} className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent" />
        <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs text-white backdrop-blur">
          Kommande
        </div>
      </div>

      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold truncate">{event.name}</div>
            <div className="text-sm text-white/60">
              {typeLabel(event.event_type)} • {fmtDateTime(event.starts_at)}
            </div>
            {event.course && <div className="mt-1 text-sm text-white/60 truncate">{event.course}</div>}
          </div>
          <span className="text-sm text-white/70 shrink-0">Öppna →</span>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px] text-white/75">
          {event.setting_wind && <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">🌬️ {event.setting_wind}</span>}
          {event.setting_tee_meters && <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">⛳ {event.setting_tee_meters}</span>}
          {event.setting_pins && <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">📍 {event.setting_pins}</span>}
        </div>
      </div>
    </Link>
  );
}

/* ===========================
   Page
=========================== */
export default async function Page() {
  const sb = supabaseServer();

  // current season
  const currentResp = await sb.from("seasons").select("id,name,created_at").eq("is_current", true).limit(1).single();
  let season = (currentResp.data as SeasonRow | null) ?? null;

  if (!season) {
    const latestResp = await sb.from("seasons").select("id,name,created_at").order("created_at", { ascending: false }).limit(1).single();
    season = (latestResp.data as SeasonRow | null) ?? null;
  }

  if (!season) return <div className="text-white/70">Ingen säsong hittades.</div>;
  const seasonQuery = `?season=${encodeURIComponent(season.id)}`;

  // rules
  const rulesResp = await sb
    .from("season_rules")
    .select("vanlig_best_of,major_best_of,lagtavling_best_of")
    .eq("season_id", season.id)
    .single();

  const rules =
    ((rulesResp.data as RulesRow | null) ?? null) ?? ({
      vanlig_best_of: 4,
      major_best_of: 3,
      lagtavling_best_of: 2,
    } as RulesRow);

  // players
  const spResp = await sb.from("season_players").select("id,person_id,hcp,people(name,avatar_url)").eq("season_id", season.id);
  const players = ((spResp.data ?? []) as any[]).map((p) => ({
    id: String(p.id),
    person_id: String(p.person_id),
    hcp: Number(p.hcp ?? 0),
    people: p.people ?? null,
  })) as SeasonPlayerRow[];
  const spIds = players.map((p) => p.id);

  // events
  const eventsResp = await sb
    .from("events")
    .select("id,season_id,name,event_type,starts_at,course,locked,image_url,setting_wind,setting_tee_meters,setting_pins")
    .eq("season_id", season.id)
    .order("starts_at", { ascending: true });

  const events = (eventsResp.data as EventRow[] | null) ?? [];
  const lockedEvents = events.filter((e) => e.locked);

  const now = new Date();
  const nextEvent =
    events
      .filter((e) => new Date(e.starts_at).getTime() > now.getTime() && !e.locked)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0] ?? null;

  const lastPlayed =
    lockedEvents.slice().sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())[0] ?? null;

  const finalEvent = events.find((e) => e.event_type === "FINAL") ?? null;
  const finalDays = finalEvent ? daysUntil(finalEvent.starts_at) : null;

  // results for leaderboard
  const lockedEventIds = lockedEvents.map((e) => e.id);
  const typeByEvent = new Map<string, string>();
  for (const e of events) typeByEvent.set(e.id, e.event_type);

  let results: ResRow[] = [];
  if (lockedEventIds.length && spIds.length) {
    const resResp = await sb
      .from("results")
      .select("season_player_id,event_id,poang,did_not_play")
      .in("event_id", lockedEventIds)
      .in("season_player_id", spIds);

    results = (resResp.data ?? []) as any[] as ResRow[];
  }

  const bySp = new Map<string, { vanlig: number[]; major: number[]; lag: number[] }>();
  for (const p of players) bySp.set(p.id, { vanlig: [], major: [], lag: [] });

  for (const r of results) {
    if (r.did_not_play) continue;
    const t = typeByEvent.get(r.event_id);
    const b = bySp.get(r.season_player_id);
    if (!t || !b) continue;

    const pts = Number(r.poang ?? 0);
    if (t === "VANLIG") b.vanlig.push(pts);
    else if (t === "MAJOR") b.major.push(pts);
    else if (t === "LAGTÄVLING") b.lag.push(pts);
  }

  const leaderboard = players
    .map((p) => {
      const name = p.people?.name ?? "Okänd";
      const avatar_url = p.people?.avatar_url ?? null;
      const b = bySp.get(p.id)!;
      const total =
        sumTopN(b.vanlig, rules.vanlig_best_of) +
        sumTopN(b.major, rules.major_best_of) +
        sumTopN(b.lag, rules.lagtavling_best_of);
      return { person_id: p.person_id, name, avatar_url, total };
    })
    .sort((a, b) => b.total - a.total);

  const leader = leaderboard[0] ?? null;
  const top5 = leaderboard.slice(0, 5);

  // top3 last played
  let top3: TopRow[] = [];
  if (lastPlayed) {
    const topResp = await sb
      .from("results")
      .select("placering,poang,gross_strokes,net_strokes,adjusted_score,season_players(person_id,people(name,avatar_url))")
      .eq("event_id", lastPlayed.id)
      .not("placering", "is", null)
      .order("placering", { ascending: true })
      .limit(3);

    top3 = (topResp.data ?? []) as any as TopRow[];
  }

  return (
    <main className="space-y-6">
      {/* HEADER */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        {/* Logo + Title */}
        <div className="flex items-center gap-8">
          {/* Logo no box */}
          <div
            className="shrink-0"
            style={{ width: LOGO_MOBILE, height: LOGO_MOBILE }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
  src="/icons/pncuplogga-v2.png"
  alt="PostNord Cup"
  className="
    h-22 w-22
    sm:h-16 sm:w-16
    md:h-20 md:w-20
    lg:h-24 lg:w-24
    object-contain
    shrink-0
  "
/>
          </div>

          {/* Title (no ellipsis) */}
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight break-words">
              {season.name}
            </h1>
            <p className="mt-2 text-sm sm:text-base text-white/60">Trackman @ Troxhammar GK</p>
          </div>
        </div>

        {/* Symmetric cards */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {leader ? (
            <MiniCard
              href={`/players/${leader.person_id}${seasonQuery}`}
              kicker="Ledare"
              title={leader.name}
              sub={`${leader.total.toLocaleString("sv-SE")} p`}
              thumb={<AvatarRound url={leader.avatar_url} name={leader.name} size={56} />}
            />
          ) : (
            <div className="h-[120px] rounded-2xl border border-white/10 bg-black/20 p-4 text-white/60">
              Ingen ledare ännu
            </div>
          )}

          {finalEvent ? (
            <MiniCard
              href={`/events/${finalEvent.id}${seasonQuery}`}
              kicker="PostNord Cup Final"
              title={`Final om ${finalDays ?? "—"} dagar`}
              sub={`${fmtDateShort(finalEvent.starts_at)}${finalEvent.course ? ` • ${finalEvent.course}` : ""}`}
              thumb={<Thumb url={finalEvent.image_url} alt="Final" />}
            />
          ) : (
            <div className="h-[120px] rounded-2xl border border-white/10 bg-black/20 p-4 text-white/60">
              Ingen final inlagd
            </div>
          )}

          {nextEvent ? (
            <MiniCard
              href={`/events/${nextEvent.id}${seasonQuery}`}
              kicker="Nästa tävling"
              title={nextEvent.name}
              sub={`${fmtDateShort(nextEvent.starts_at)} • ${typeLabel(nextEvent.event_type)}`}
              thumb={<Thumb url={nextEvent.image_url} alt={nextEvent.name} />}
            >
              <div className="mt-2 flex items-center gap-3 text-[11px] text-white/75">
                {nextEvent.setting_wind ? <span>🌬️ {nextEvent.setting_wind}</span> : null}
                {nextEvent.setting_tee_meters ? <span>⛳ {nextEvent.setting_tee_meters}</span> : null}
                {nextEvent.setting_pins ? <span>📍 {nextEvent.setting_pins}</span> : null}
              </div>
            </MiniCard>
          ) : (
            <div className="h-[120px] rounded-2xl border border-white/10 bg-black/20 p-4 text-white/60">
              Ingen kommande tävling
            </div>
          )}
        </div>
      </section>

      {/* TOPP 5 */}
      <section className="space-y-2">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-semibold">🏆 Topp 5</h2>
          <div />
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {top5.map((r, idx) => (
            <div key={r.person_id} className="flex items-center justify-between border-b border-white/10 px-4 py-3 last:border-b-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 text-white/60">{idx + 1}</div>
                <Link href={`/players/${r.person_id}${seasonQuery}`} className="font-medium hover:underline truncate">
                  {r.name}
                </Link>
              </div>
              <div className="font-semibold">{r.total.toLocaleString("sv-SE")}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TOPP 3 */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs text-white/60">Topp 3</div>
            <div className="font-semibold">{lastPlayed ? `Senaste: ${lastPlayed.name}` : "Ingen spelad tävling ännu"}</div>
            {lastPlayed && (
              <div className="text-sm text-white/60">
                {typeLabel(lastPlayed.event_type)} • {fmtDateTime(lastPlayed.starts_at)}
              </div>
            )}
          </div>

          {lastPlayed && (
            <Link href={`/events/${lastPlayed.id}${seasonQuery}`} className="text-sm text-white/70 hover:underline">
              Öppna tävling →
            </Link>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {top3.length ? (
            top3.map((r) => {
              const name = r.season_players?.people?.name ?? "Okänd";
              const avatar = r.season_players?.people?.avatar_url ?? null;
              const personId = r.season_players?.person_id ?? "";
              const medal = medalForPlacing(r.placering);

              const strokes =
                r.adjusted_score != null ? r.adjusted_score : r.net_strokes != null ? r.net_strokes : r.gross_strokes;

              const pts = Number(r.poang ?? 0);

              return (
                <Link
                  key={`${personId}-${r.placering ?? "x"}`}
                  href={personId ? `/players/${personId}${seasonQuery}` : "#"}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4 hover:bg-black/30 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-lg">{medal}</div>
                    <AvatarRound url={avatar} name={name} size={40} />
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{name}</div>
                      <div className="text-xs text-white/60">
                        {strokes ?? "—"} slag • {pts.toLocaleString("sv-SE")} p
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="text-white/60">Inga resultat att visa.</div>
          )}
        </div>
      </section>

      {/* NEXT EVENT BIG */}
      <section className="space-y-2">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-semibold">🗓️ Nästa tävling</h2>
          <div />
        </div>

        <NextEventBig event={nextEvent} seasonQuery={seasonQuery} />
      </section>
    </main>
  );
}