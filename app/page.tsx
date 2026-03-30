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

/* ===========================
   Types
=========================== */
type SeasonRow = { id: string; name: string; created_at?: string; is_current?: boolean };

type RulesRow = {
  vanlig_best_of: number;
  major_best_of: number;
  lagtavling_best_of: number;
};

type SeasonPlayerRow = {
  id: string;
  person_id: string;
  hcp: number;
  people: PersonRow | null;
};

type PersonRow = {
  name: string;
  avatar_url: string | null;
};

type SeasonPlayerRespRow = {
  id: string;
  person_id: string;
  hcp: number;
  people: PersonRow | PersonRow[] | null;
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
  placering: number | null;
  did_not_play: boolean;
};

type TopRow = {
  placering: number | null;
  poang: number | null;
  gross_strokes: number | null;
  net_strokes: number | null;
  adjusted_score: number | null;
  lag_score: number | null;
  season_players: {
    person_id: string;
    people: PersonRow | null;
  } | null;
};

type TopRespRow = {
  placering: number | null;
  poang: number | null;
  gross_strokes: number | null;
  net_strokes: number | null;
  adjusted_score: number | null;
  lag_score: number | null;
  season_players:
    | {
        person_id: string;
        people: PersonRow | PersonRow[] | null;
      }
    | Array<{
        person_id: string;
        people: PersonRow | PersonRow[] | null;
      }>
    | null;
};

type SummaryPerson = {
  person_id: string;
  name: string;
  avatar_url: string | null;
};

type LeaderboardRow = SummaryPerson & {
  total: number;
  played: number;
  wins: number;
  podiums: number;
  playedByType: {
    vanlig: number;
    major: number;
    lag: number;
    final: number;
  };
  avgPlace: number | null;
};

type SummaryStatLine = {
  label: string;
  value: string;
  players: SummaryPerson[];
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

function podiumHeight(placing: number | null) {
  if (placing === 1) return "h-32 sm:h-36";
  if (placing === 2) return "h-24 sm:h-28";
  if (placing === 3) return "h-20 sm:h-24";
  return "h-20";
}

function podiumTone(placing: number | null) {
  if (placing === 1) return "from-amber-300/20 via-amber-200/10 to-white/5 border-amber-200/20";
  if (placing === 2) return "from-slate-200/20 via-slate-100/10 to-white/5 border-slate-200/20";
  if (placing === 3) return "from-orange-400/20 via-orange-200/10 to-white/5 border-orange-200/20";
  return "from-white/10 to-white/5 border-white/10";
}

function fmtNames(names: string[]) {
  if (names.length === 0) return "—";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

async function resolveSeason(
  sb: ReturnType<typeof supabaseServer>,
  requestedSeasonId: string | null
): Promise<SeasonRow | null> {
  if (requestedSeasonId) {
    const requested = await sb
      .from("seasons")
      .select("id,name,created_at,is_current")
      .eq("id", requestedSeasonId)
      .single();

    if (requested.data) return requested.data as SeasonRow;
  }

  const current = await sb
    .from("seasons")
    .select("id,name,created_at,is_current")
    .eq("is_current", true)
    .limit(1)
    .single();
  if (current.data) return current.data as SeasonRow;

  const latest = await sb
    .from("seasons")
    .select("id,name,created_at,is_current")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return (latest.data as SeasonRow | null) ?? null;
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

function FacePile({
  players,
  size = 28,
}: {
  players: SummaryPerson[];
  size?: number;
}) {
  const visible = players.slice(0, 3);
  const remaining = players.length - visible.length;

  return (
    <div className="flex h-full items-center">
      <div className="flex -space-x-2">
        {visible.map((player) => (
          <div
            key={player.person_id}
            className="rounded-full ring-2 ring-[#0b1220]"
            style={{ width: size, height: size }}
          >
            <AvatarRound url={player.avatar_url} name={player.name} size={size} />
          </div>
        ))}
      </div>
      {remaining > 0 ? <div className="ml-2 text-[10px] text-white/45">+{remaining}</div> : null}
    </div>
  );
}

function FactTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">{label}</div>
      <div className="mt-2 text-sm font-medium leading-snug text-white/90 break-words sm:text-base">{value}</div>
    </div>
  );
}

function PlayedBreakdown({ row }: { row: LeaderboardRow }) {
  return (
    <div className="space-y-1">
      <div>{row.played.toLocaleString("sv-SE")} tävlingar</div>
      <div className="text-xs text-white/65">
        Vanlig {row.playedByType.vanlig} • Major {row.playedByType.major} • Lag {row.playedByType.lag} • Final{" "}
        {row.playedByType.final}
      </div>
    </div>
  );
}

function FinishedHighlightCard({
  href,
  kicker,
  title,
  subtitle,
  person,
  children,
  className,
}: {
  href: string;
  kicker: string;
  title: string;
  subtitle: string;
  person: SummaryPerson | null;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={[
        "group block min-w-0 overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(10,14,24,0.82))] transition hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(10,14,24,0.90))]",
        className ?? "",
      ].join(" ")}
    >
      <div className="flex min-h-[220px] flex-col justify-between p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">{kicker}</div>
            <div className="mt-3 text-2xl font-semibold leading-tight break-words sm:text-[30px]">{title}</div>
            <div className="mt-2 text-sm leading-snug text-white/65 break-words sm:text-base">{subtitle}</div>
          </div>

          {person ? (
            <div className="shrink-0 rounded-full border border-white/10 bg-white/5 p-1">
              <AvatarRound url={person.avatar_url} name={person.name} size={72} />
            </div>
          ) : null}
        </div>

        {children ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{children}</div> : null}
      </div>
    </Link>
  );
}

function FinishedStatsCard({
  href,
  lines,
  footer,
}: {
  href: string;
  lines: SummaryStatLine[];
  footer: string;
}) {
  return (
    <Link
      href={href}
      className="group block min-w-0 overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(10,14,24,0.85))] transition hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(10,14,24,0.92))]"
      title="Säsongsstatistik"
    >
      <div className="flex min-h-[220px] flex-col p-5 sm:p-6">
        <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Säsongsstatistik</div>

        <div className="mt-5 space-y-4">
          {lines.map((line) => (
            <div
              key={line.label}
              className="grid min-w-0 grid-cols-[64px_minmax(0,1fr)] items-start gap-x-4"
            >
              <div className="flex min-h-[52px] items-center">
                <FacePile players={line.players} />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">{line.label}</div>
                <div className="mt-1 text-sm font-medium leading-snug text-white/90 break-words">{line.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-5 text-xs text-white/45 break-words">{footer}</div>
      </div>
    </Link>
  );
}

function podiumMetaForRow(row: TopRow, eventType: string) {
  const strokes =
    eventType === "LAGTÄVLING"
      ? row.lag_score
      : row.adjusted_score != null
      ? row.adjusted_score
      : row.net_strokes != null
      ? row.net_strokes
      : row.gross_strokes;

  const pts = Number(row.poang ?? 0);
  return pts > 0 ? `${strokes ?? "—"} slag • ${pts.toLocaleString("sv-SE")} p` : `${strokes ?? "—"} slag`;
}

function podiumSymbol(placing: number) {
  if (placing === 1) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/icons/final-1.png" alt="Pokalen" className="h-28 w-28 object-contain sm:h-32 sm:w-32" />
    );
  }
  if (placing === 2) return <span className="text-4xl leading-none sm:text-5xl">🥈</span>;
  return <span className="text-4xl leading-none sm:text-5xl">🥉</span>;
}

function FinishedPodiumSection({
  event,
  rows,
  seasonQuery,
}: {
  event: EventRow;
  rows: TopRow[];
  seasonQuery: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/5">
      {event.image_url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.image_url}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.14]"
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(126,184,255,0.20),transparent_45%),linear-gradient(180deg,rgba(6,12,22,0.25),rgba(6,12,22,0.92))]" />
        </>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(126,184,255,0.20),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(6,12,22,0.92))]" />
      )}

      <div className="relative p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="text-2xl font-semibold leading-tight break-words sm:text-3xl">{event.name}</div>
            <div className="mt-3 text-sm text-white/60 break-words">
              {fmtDateShort(event.starts_at)}
            </div>
            {event.course ? <div className="text-sm text-white/60 break-words">{event.course}</div> : null}
          </div>

          <Link
            href={`/events/${event.id}${seasonQuery}`}
            className="shrink-0 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/85 transition hover:bg-black/30"
          >
            Öppna finalen →
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-3 items-end gap-2 sm:gap-4 lg:gap-6">
          {[2, 1, 3].map((place) => {
            const row = rows.find((entry) => entry.placering === place) ?? null;
            if (!row) {
              return (
                <div
                  key={`empty-${place}`}
                  className="min-h-[220px] rounded-[24px] border border-dashed border-white/10 bg-black/10"
                />
              );
            }

            const personId = row.season_players?.person_id ?? "";
            const name = row.season_players?.people?.name ?? "Okänd";
            const avatar = row.season_players?.people?.avatar_url ?? null;

            return (
              <Link
                key={`${personId}-${place}`}
                href={personId ? `/players/${personId}${seasonQuery}` : "#"}
                className="group block min-w-0"
              >
                <div className="flex min-h-[220px] flex-col items-center px-2 pb-0 pt-4 text-center sm:px-4">
                  <div
                    className={
                      place === 1
                        ? "rounded-full bg-[radial-gradient(circle,rgba(250,214,110,0.30)_0%,rgba(250,214,110,0.08)_55%,transparent_75%)] p-[6px] shadow-[0_0_40px_rgba(245,204,96,0.35)]"
                        : ""
                    }
                  >
                    <AvatarRound url={avatar} name={name} size={place === 1 ? 72 : 58} />
                  </div>

                  <div className="mt-3 min-w-0">
                    <div className="text-xs font-semibold leading-tight text-white break-words sm:text-sm">{name}</div>
                    <div className="mt-1 text-[10px] leading-tight text-white/60 break-words sm:text-[11px]">
                      {podiumMetaForRow(row, event.event_type)}
                    </div>
                  </div>

                  <div
                    className={`mt-4 flex w-full items-start justify-center rounded-t-[24px] border border-b-0 bg-gradient-to-b px-2 pb-4 pt-5 ${podiumHeight(
                      place
                    )} ${podiumTone(place)}`}
                  >
                    <div className="pt-1">
                      <div className="flex items-center justify-center">{podiumSymbol(place)}</div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MiniCard({
  href,
  kicker,
  title,
  sub,
  thumb,
  children,
  compact = false,
}: {
  href: string;
  kicker: string;
  title: string;
  sub?: string | null;
  thumb: React.ReactNode;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group block min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-black/20 hover:bg-black/30 transition"
      title={title}
    >
      <div className={`flex min-w-0 items-start gap-4 p-4 ${compact ? "min-h-[120px]" : "min-h-[132px]"}`}>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] text-white/60">{kicker}</div>
          <div className="mt-1 text-[15px] font-semibold leading-snug break-words">{title}</div>
          {sub ? <div className="mt-1 text-[11px] leading-snug text-white/60 break-words">{sub}</div> : null}
          {children ? <div className="mt-2">{children}</div> : null}
        </div>
        <div className="flex shrink-0 items-start pt-1">{thumb}</div>
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
        <img
          src={event.image_url ?? "/icons/pncuplogga.png"}
          alt={event.name}
          className="h-full w-full object-cover"
        />
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
          {event.setting_wind && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">🌬️ {event.setting_wind}</span>
          )}
          {event.setting_tee_meters && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">⛳ {event.setting_tee_meters}</span>
          )}
          {event.setting_pins && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">📍 {event.setting_pins}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ===========================
   Page
=========================== */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const sb = supabaseServer();
  const sp = await searchParams;

  const season = await resolveSeason(sb, sp?.season ?? null);
  if (!season) return <div className="text-white/70">Ingen säsong hittades.</div>;
  const seasonQuery = `?season=${encodeURIComponent(season.id)}`;

  // rules
  const rulesResp = await sb
    .from("season_rules")
    .select("vanlig_best_of,major_best_of,lagtavling_best_of")
    .eq("season_id", season.id)
    .single();

  const rules =
    ((rulesResp.data as RulesRow | null) ?? null) ??
    ({
      vanlig_best_of: 4,
      major_best_of: 3,
      lagtavling_best_of: 2,
    } as RulesRow);

  // players
  const spResp = await sb.from("season_players").select("id,person_id,hcp,people(name,avatar_url)").eq("season_id", season.id);
  const players = ((spResp.data ?? []) as SeasonPlayerRespRow[]).map((p) => ({
    id: String(p.id),
    person_id: String(p.person_id),
    hcp: Number(p.hcp ?? 0),
    people: Array.isArray(p.people) ? p.people[0] ?? null : p.people ?? null,
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
      .select("season_player_id,event_id,poang,placering,did_not_play")
      .in("event_id", lockedEventIds)
      .in("season_player_id", spIds);

    results = (resResp.data ?? []) as ResRow[];
  }

  const playerMeta = new Map(
    players.map((p) => [
      p.id,
      {
        person_id: p.person_id,
        name: p.people?.name ?? "Okänd",
        avatar_url: p.people?.avatar_url ?? null,
      },
    ])
  );

  const bySp = new Map<
    string,
    {
      vanlig: number[];
      major: number[];
      lag: number[];
      played: number;
      wins: number;
      podiums: number;
      playedByType: { vanlig: number; major: number; lag: number; final: number };
      placeSum: number;
      placeCount: number;
    }
  >();
  for (const p of players) {
    bySp.set(p.id, {
      vanlig: [],
      major: [],
      lag: [],
      played: 0,
      wins: 0,
      podiums: 0,
      playedByType: { vanlig: 0, major: 0, lag: 0, final: 0 },
      placeSum: 0,
      placeCount: 0,
    });
  }

  for (const r of results) {
    if (r.did_not_play) continue;
    const t = typeByEvent.get(r.event_id);
    const b = bySp.get(r.season_player_id);
    if (!t || !b) continue;

    b.played += 1;
    if (t === "VANLIG") b.playedByType.vanlig += 1;
    else if (t === "MAJOR") b.playedByType.major += 1;
    else if (t === "LAGTÄVLING") b.playedByType.lag += 1;
    else if (t === "FINAL") b.playedByType.final += 1;
    if (r.placering === 1) b.wins += 1;
    if (typeof r.placering === "number" && r.placering <= 3) b.podiums += 1;
    if (typeof r.placering === "number") {
      b.placeSum += r.placering;
      b.placeCount += 1;
    }

    const pts = Number(r.poang ?? 0);
    if (t === "VANLIG") b.vanlig.push(pts);
    else if (t === "MAJOR") b.major.push(pts);
    else if (t === "LAGTÄVLING") b.lag.push(pts);
  }

  const leaderboard: LeaderboardRow[] = players
    .map((p) => {
      const b = bySp.get(p.id)!;
      const total =
        sumTopN(b.vanlig, rules.vanlig_best_of) +
        sumTopN(b.major, rules.major_best_of) +
        sumTopN(b.lag, rules.lagtavling_best_of);
      return {
        person_id: p.person_id,
        name: p.people?.name ?? "Okänd",
        avatar_url: p.people?.avatar_url ?? null,
        total,
        played: b.played,
        wins: b.wins,
        podiums: b.podiums,
        playedByType: b.playedByType,
        avgPlace: b.placeCount > 0 ? b.placeSum / b.placeCount : null,
      };
    })
    .sort((a, b) => b.total - a.total);

  const leader = leaderboard[0] ?? null;
  const top5 = leaderboard.slice(0, 5);

  const finalWinnerRow =
    finalEvent && finalEvent.locked
      ? results.find((r) => r.event_id === finalEvent.id && r.placering === 1 && !r.did_not_play) ?? null
      : null;
  const finalWinner = finalWinnerRow ? playerMeta.get(finalWinnerRow.season_player_id) ?? null : null;
  const finalWinnerStats =
    finalWinner ? leaderboard.find((player) => player.person_id === finalWinner.person_id) ?? null : null;
  const seasonFinished = Boolean(finalEvent?.locked && finalWinner);
  const sameChampion = Boolean(finalWinner && leader && finalWinner.person_id === leader.person_id);

  const playedEventCount = lockedEvents.length;
  const fullAttendancePlayers =
    playedEventCount > 0 ? leaderboard.filter((p) => p.played === playedEventCount) : [];

  const mostWins = Math.max(0, ...leaderboard.map((p) => p.wins));
  const mostWinPlayers = mostWins > 0 ? leaderboard.filter((p) => p.wins === mostWins) : [];

  const mostPodiums = Math.max(0, ...leaderboard.map((p) => p.podiums));
  const mostPodiumPlayers = mostPodiums > 0 ? leaderboard.filter((p) => p.podiums === mostPodiums) : [];

  const mostStarts = Math.max(0, ...leaderboard.map((p) => p.played));
  const mostStartPlayers = mostStarts > 0 ? leaderboard.filter((p) => p.played === mostStarts) : [];

  const statsLines: SummaryStatLine[] =
    fullAttendancePlayers.length > 0
      ? [
          {
            label: "Full närvaro",
            value: fmtNames(fullAttendancePlayers.map((p) => p.name)),
            players: fullAttendancePlayers,
          },
          {
            label: "Flest pokaler",
            value: `${fmtNames(mostWinPlayers.map((p) => p.name))} • ${mostWins}`,
            players: mostWinPlayers,
          },
          {
            label: "Flest pallplatser",
            value: `${fmtNames(mostPodiumPlayers.map((p) => p.name))} • ${mostPodiums}`,
            players: mostPodiumPlayers,
          },
        ]
      : [
          {
            label: "Närmast full närvaro",
            value: `${fmtNames(mostStartPlayers.map((p) => p.name))} • ${mostStarts}/${playedEventCount}`,
            players: mostStartPlayers,
          },
          {
            label: "Flest pokaler",
            value: `${fmtNames(mostWinPlayers.map((p) => p.name))} • ${mostWins}`,
            players: mostWinPlayers,
          },
          {
            label: "Flest pallplatser",
            value: `${fmtNames(mostPodiumPlayers.map((p) => p.name))} • ${mostPodiums}`,
            players: mostPodiumPlayers,
          },
        ];

  const podiumEvent = seasonFinished && finalEvent ? finalEvent : lastPlayed;

  // top3 podium event
  let top3: TopRow[] = [];
  if (podiumEvent) {
    const topResp = await sb
      .from("results")
      .select("placering,poang,gross_strokes,net_strokes,adjusted_score,lag_score,season_players(person_id,people(name,avatar_url))")
      .eq("event_id", podiumEvent.id)
      .not("placering", "is", null)
      .order("placering", { ascending: true })
      .limit(3);

    top3 = ((topResp.data ?? []) as TopRespRow[]).map((row) => {
      const seasonPlayer = Array.isArray(row.season_players)
        ? row.season_players[0] ?? null
        : row.season_players ?? null;

      return {
        ...row,
        season_players: seasonPlayer
          ? {
              ...seasonPlayer,
              people: Array.isArray(seasonPlayer.people)
                ? seasonPlayer.people[0] ?? null
                : seasonPlayer.people ?? null,
            }
          : null,
      };
    }) as TopRow[];
  }

  return (
    <main className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-white/5 p-5 backdrop-blur sm:p-6">
        <div className="flex items-center gap-5 sm:gap-8">
          <div
            className="shrink-0"
            style={{ width: LOGO_MOBILE, height: LOGO_MOBILE }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/pncuplogga-v4.png"
              alt="PostNord Cup"
              className="
                h-22 w-22
                sm:h-16 sm:w-16
                md:h-20 md:w-20
                lg:h-24 lg:w-24
                object-contain
                shrink-0
                animate-[pnLogoGlow_3.2s_ease-in-out_infinite]
              "
              style={{ willChange: "transform, filter" }}
            />
          </div>

          <div className="min-w-0">
            {seasonFinished ? (
              <div className="mb-2 inline-flex items-center rounded-full border border-emerald-300/15 bg-emerald-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-100">
                Säsongen avslutad
              </div>
            ) : null}
            <h1 className="text-3xl font-semibold tracking-tight leading-tight break-words sm:text-4xl">
              {season.name}
            </h1>
            <p className="mt-2 text-sm text-white/60 sm:text-base">Trackman @ Troxhammar GK</p>
          </div>
        </div>
      </section>

      {seasonFinished && finalWinner && finalEvent ? (
        <>
          <FinishedPodiumSection event={finalEvent} rows={top3} seasonQuery={seasonQuery} />

          <section className="grid gap-4 lg:grid-cols-3">
            {sameChampion && leader ? (
              <FinishedHighlightCard
                href={`/leaderboard${seasonQuery}`}
                kicker="Säsongens dominant"
                title={leader.name}
                subtitle="Vann både PostNord Cup Final och grundserien"
                person={leader}
                className="lg:col-span-2"
              >
                <FactTile label="Spelade" value={<PlayedBreakdown row={leader} />} />
                <FactTile label="Pokaler" value={`${leader.wins.toLocaleString("sv-SE")} vinster`} />
                <FactTile label="Pallplatser" value={`${leader.podiums.toLocaleString("sv-SE")} totalt`} />
                <FactTile
                  label="Snittplacering"
                  value={leader.avgPlace != null ? leader.avgPlace.toLocaleString("sv-SE", { maximumFractionDigits: 1 }) : "—"}
                />
              </FinishedHighlightCard>
            ) : (
              <>
                <FinishedHighlightCard
                  href={`/events/${finalEvent.id}${seasonQuery}`}
                  kicker="Säsongens mästare"
                  title={finalWinner.name}
                  subtitle={`Vann ${finalEvent.name}`}
                  person={finalWinner}
                >
                  <FactTile label="Spelade" value={finalWinnerStats ? <PlayedBreakdown row={finalWinnerStats} /> : "—"} />
                  <FactTile
                    label="Pokaler"
                    value={`${(finalWinnerStats?.wins ?? 0).toLocaleString("sv-SE")} vinster`}
                  />
                  <FactTile
                    label="Pallplatser"
                    value={`${(finalWinnerStats?.podiums ?? 0).toLocaleString("sv-SE")} totalt`}
                  />
                  <FactTile
                    label="Snittplacering"
                    value={
                      finalWinnerStats?.avgPlace != null
                        ? finalWinnerStats.avgPlace.toLocaleString("sv-SE", { maximumFractionDigits: 1 })
                        : "—"
                    }
                  />
                </FinishedHighlightCard>

                {leader ? (
                  <FinishedHighlightCard
                    href={`/leaderboard${seasonQuery}`}
                    kicker="Vinnare av grundserien"
                    title={leader.name}
                    subtitle={`${leader.total.toLocaleString("sv-SE")} poäng i slutställningen`}
                    person={leader}
                  >
                    <FactTile label="Spelade" value={<PlayedBreakdown row={leader} />} />
                    <FactTile label="Pokaler" value={`${leader.wins.toLocaleString("sv-SE")} vinster`} />
                    <FactTile label="Pallplatser" value={`${leader.podiums.toLocaleString("sv-SE")} totalt`} />
                    <FactTile
                      label="Snittplacering"
                      value={leader.avgPlace != null ? leader.avgPlace.toLocaleString("sv-SE", { maximumFractionDigits: 1 }) : "—"}
                    />
                  </FinishedHighlightCard>
                ) : (
                  <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 text-white/60 sm:p-6">
                    Ingen grundserievinnare ännu
                  </div>
                )}
              </>
            )}

            <FinishedStatsCard
              href={`/overview${seasonQuery}`}
              lines={statsLines}
              footer={`${playedEventCount.toLocaleString("sv-SE")} tävlingar - ${players.length.toLocaleString("sv-SE")} deltagare`}
            />
          </section>
        </>
      ) : (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="mt-1 grid gap-4 lg:grid-cols-3">
            {leader ? (
              <MiniCard
                href={`/players/${leader.person_id}${seasonQuery}`}
                kicker="Ledare"
                title={leader.name}
                sub={`${leader.total.toLocaleString("sv-SE")} p`}
                thumb={<AvatarRound url={leader.avatar_url} name={leader.name} size={50} />}
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
      )}

      {/* TOPP 5 */}
      <section className="space-y-2">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-semibold">{seasonFinished ? "Slutställning" : "🏆 Topp 5"}</h2>
          <div />
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {top5.map((r, idx) => (
            <div key={r.person_id} className="flex items-center justify-between border-b border-white/10 px-4 py-3 last:border-b-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 text-white/60">{idx + 1}</div>
                <AvatarRound url={r.avatar_url} name={r.name} size={34} />
                <Link href={`/players/${r.person_id}${seasonQuery}`} className="font-medium hover:underline truncate">
                  {r.name}
                </Link>
              </div>
              <div className="font-semibold">{r.total.toLocaleString("sv-SE")}</div>
            </div>
          ))}
        </div>
      </section>

      {!seasonFinished ? (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs text-white/60">Topp 3</div>
              <div className="font-semibold">
                {lastPlayed ? `Senaste: ${lastPlayed.name}` : "Ingen spelad tävling ännu"}
              </div>
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

          <div className="mt-4">
            {top3.length ? (
              <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
                {[2, 1, 3].map((place) => {
                  const r = top3.find((row) => row.placering === place) ?? null;
                  if (!r) {
                    return <div key={`empty-${place}`} />;
                  }

                  const name = r.season_players?.people?.name ?? "Okänd";
                  const avatar = r.season_players?.people?.avatar_url ?? null;
                  const personId = r.season_players?.person_id ?? "";
                  const medal = medalForPlacing(r.placering);

                  const strokes =
                    lastPlayed?.event_type === "LAGTÄVLING"
                      ? r.lag_score
                      : r.adjusted_score != null
                      ? r.adjusted_score
                      : r.net_strokes != null
                      ? r.net_strokes
                      : r.gross_strokes;

                  const pts = Number(r.poang ?? 0);
                  const meta = pts > 0 ? `${strokes ?? "—"} slag • ${pts.toLocaleString("sv-SE")} p` : `${strokes ?? "—"} slag`;

                  return (
                    <Link
                      key={`${personId}-${r.placering ?? "x"}`}
                      href={personId ? `/players/${personId}${seasonQuery}` : "#"}
                      className="group block min-w-0"
                    >
                      <div className="flex flex-col items-center text-center">
                        <div className="mb-2 text-2xl sm:text-3xl">{medal}</div>
                        <AvatarRound url={avatar} name={name} size={place === 1 ? 64 : 54} />
                        <div className="mt-2 min-w-0">
                          <div className="text-xs font-semibold leading-tight text-white sm:text-sm break-words">
                            {name}
                          </div>
                          <div className="mt-1 text-[10px] leading-tight text-white/60 sm:text-[11px] break-words">
                            {meta}
                          </div>
                        </div>

                        <div
                          className={`mt-3 flex w-full items-end justify-center rounded-t-2xl border border-b-0 bg-gradient-to-b px-2 pb-3 pt-4 transition group-hover:bg-black/30 ${podiumHeight(
                            r.placering
                          )} ${podiumTone(r.placering)}`}
                        >
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">Plats</div>
                            <div className="mt-1 text-2xl font-semibold text-white sm:text-3xl">{r.placering}</div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-white/60">Inga resultat att visa.</div>
            )}
          </div>
        </section>
      ) : null}

      {!seasonFinished ? (
        <section className="space-y-2">
          <div className="flex items-end justify-between">
            <h2 className="text-xl font-semibold">🗓️ Nästa tävling</h2>
            <div />
          </div>

          <NextEventBig event={nextEvent} seasonQuery={seasonQuery} />
        </section>
      ) : null}
    </main>
  );
}
