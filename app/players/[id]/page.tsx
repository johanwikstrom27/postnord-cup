export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";

/* ===========================
   Types
=========================== */
type SeasonRow = { id: string; name: string; created_at: string; is_current?: boolean };

type PeopleRow = {
  id: string;
  name: string;
  avatar_url: string | null;
  bio?: string | null;
};

type RulesRow = {
  vanlig_best_of: number | null;
  major_best_of: number | null;
  lagtavling_best_of: number | null;
};

type SeasonPlayerRow = {
  id: string; // season_player_id
  season_id: string;
  person_id: string;
  hcp: number;
};

type ResultWinRow = {
  event_id: string;
  poang: number | null;
  events: {
    id: string;
    name: string;
    event_type: string;
    starts_at: string;
    season_id: string;
    locked: boolean;
  } | null;
};

type ResultRow = {
  event_id: string;
  placering: number | null;
  poang: number | null;
  did_not_play: boolean;
  events: {
    id: string;
    name: string;
    event_type: string;
    starts_at: string;
    season_id: string;
    locked: boolean;
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

function sumTopN(values: number[], n: number) {
  return values
    .slice()
    .sort((a, b) => b - a)
    .slice(0, n)
    .reduce((acc, v) => acc + v, 0);
}

function fmtInt(n: number) {
  return n.toLocaleString("sv-SE");
}

function fmtDateShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

async function resolveSeason(sb: ReturnType<typeof supabaseServer>, requestedSeasonId: string | null) {
  if (requestedSeasonId) {
    const r = await sb.from("seasons").select("id,name,created_at,is_current").eq("id", requestedSeasonId).single();
    if (r.data) return r.data as SeasonRow;
  }

  const cur = await sb.from("seasons").select("id,name,created_at,is_current").eq("is_current", true).limit(1).single();
  if (cur.data) return cur.data as SeasonRow;

  const latest = await sb.from("seasons").select("id,name,created_at,is_current").order("created_at", { ascending: false }).limit(1).single();
  return (latest.data as SeasonRow) ?? null;
}

/* ===========================
   Tiny UI pieces
=========================== */
function Avatar({ url, name, size = 56 }: { url: string | null; name: string; size?: number }) {
  return (
    <div
      className="overflow-hidden rounded-full border border-white/10 bg-white/5 shrink-0"
      style={{ width: size, height: size }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm">⛳</div>
      )}
    </div>
  );
}

function TrophySlot({
  label,
  count,
  iconSrc,
  big,
}: {
  label: string;
  count: number;
  iconSrc: string;
  big?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-end text-center">
      <div className={big ? "h-16 w-16" : "h-12 w-12"}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconSrc} alt={label} className="h-full w-full object-contain drop-shadow" />
      </div>
      <div className="mt-2 text-xs text-white/70">{label}</div>
      <div className="mt-1 inline-flex items-center justify-center rounded-md border border-white/10 bg-black/25 px-2 py-0.5 text-xs font-semibold tabular-nums">
        {count}
      </div>
    </div>
  );
}

/* ===========================
   Page
=========================== */
export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { id: personId } = await params;
  const sp = await searchParams;

  const sb = supabaseServer();

  // Person
  const personResp = await sb.from("people").select("id,name,avatar_url,bio").eq("id", personId).single();
  const person = (personResp.data as PeopleRow | null) ?? null;
  if (!person) return <div className="text-white/70">Spelaren hittades inte.</div>;

  // Current/selected season
  const season = await resolveSeason(sb, sp?.season ?? null);
  if (!season) return <div className="text-white/70">Ingen säsong hittades.</div>;
  const seasonQuery = `?season=${encodeURIComponent(season.id)}`;

  // Season player (for current season HCP)
  const spResp = await sb
    .from("season_players")
    .select("id,season_id,person_id,hcp")
    .eq("season_id", season.id)
    .eq("person_id", personId)
    .single();

  const seasonPlayer = (spResp.data as SeasonPlayerRow | null) ?? null;

  // Rules (best-of)
  const rulesResp = await sb
    .from("season_rules")
    .select("vanlig_best_of,major_best_of,lagtavling_best_of")
    .eq("season_id", season.id)
    .single();

  const rules = (rulesResp.data as RulesRow | null) ?? {
    vanlig_best_of: 4,
    major_best_of: 3,
    lagtavling_best_of: 2,
  };

  const vanligBest = Number(rules.vanlig_best_of ?? 4);
  const majorBest = Number(rules.major_best_of ?? 3);
  const lagBest = Number(rules.lagtavling_best_of ?? 2);

  // === Current season stats for this player ===
  let currentResults: ResultRow[] = [];
  if (seasonPlayer?.id) {
    const rResp = await sb
      .from("results")
      .select("event_id,placering,poang,did_not_play,events(id,name,event_type,starts_at,season_id,locked)")
      .eq("season_player_id", seasonPlayer.id);

    currentResults = (rResp.data ?? []) as any as ResultRow[];
  }

  const locked = currentResults.filter((r) => r.events?.locked === true && !r.did_not_play);

  const ptsVanlig = locked.filter((r) => r.events?.event_type === "VANLIG").map((r) => Number(r.poang ?? 0));
  const ptsMajor = locked.filter((r) => r.events?.event_type === "MAJOR").map((r) => Number(r.poang ?? 0));
  const ptsLag = locked.filter((r) => r.events?.event_type === "LAGTÄVLING").map((r) => Number(r.poang ?? 0));

  const total = sumTopN(ptsVanlig, vanligBest) + sumTopN(ptsMajor, majorBest) + sumTopN(ptsLag, lagBest);

  // === Trophy cabinet across ALL seasons ===
  // Get all season_player_ids for this person
  const allSpResp = await sb.from("season_players").select("id").eq("person_id", personId);
  const allSpIds = (allSpResp.data ?? []).map((x: any) => String(x.id));

  let wins: ResultWinRow[] = [];
  if (allSpIds.length) {
    // placering = 1 + locked events only
    const wResp = await sb
      .from("results")
      .select("event_id,poang,events(id,name,event_type,starts_at,season_id,locked)")
      .in("season_player_id", allSpIds)
      .eq("placering", 1)
      .eq("did_not_play", false);

    wins = (wResp.data ?? []) as any as ResultWinRow[];
  }

  const lockedWins = wins.filter((w) => w.events?.locked === true);

  const winCount = {
    FINAL: lockedWins.filter((w) => w.events?.event_type === "FINAL").length,
    MAJOR: lockedWins.filter((w) => w.events?.event_type === "MAJOR").length,
    LAGTÄVLING: lockedWins.filter((w) => w.events?.event_type === "LAGTÄVLING").length,
    VANLIG: lockedWins.filter((w) => w.events?.event_type === "VANLIG").length,
  };

  const last3Wins = lockedWins
    .slice()
    .sort((a, b) => new Date(b.events?.starts_at ?? 0).getTime() - new Date(a.events?.starts_at ?? 0).getTime())
    .slice(0, 3);

  return (
    <main className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Avatar url={person.avatar_url} name={person.name} size={56} />
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight truncate">{person.name}</h1>
              <div className="mt-1 text-sm text-white/60 truncate">
                {season.name} {seasonPlayer ? `• HCP ${seasonPlayer.hcp.toFixed(1)}` : "• (ej med i säsongen)"}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-white/60">Total (räknad)</div>
            <div className="text-2xl font-semibold tabular-nums">{fmtInt(total)}</div>
          </div>
        </div>
      </section>

      {/* TROFÉSKÅP */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Troféskåp</h2>
          <div className="text-xs text-white/60">Endast låsta tävlingar • alla säsonger</div>
        </div>

        {/* Shelf */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          {/* Top shelf */}
          <div className="grid grid-cols-4 gap-4 items-end">
            <TrophySlot label="Final" count={winCount.FINAL} iconSrc="/icons/final.png" big />
            <TrophySlot label="Major" count={winCount.MAJOR} iconSrc="/icons/major.png" />
            <TrophySlot label="Lagtävling" count={winCount.LAGTÄVLING} iconSrc="/icons/lagtavling.png" />
            <TrophySlot label="Vanlig" count={winCount.VANLIG} iconSrc="/icons/vanlig.png" />
          </div>

          <div className="mt-4 h-[2px] w-full rounded-full bg-gradient-to-r from-white/10 via-white/20 to-white/10" />
        </div>

        {/* Latest wins (3) */}
        <div className="mt-5">
          <div className="text-sm font-semibold text-white/90">Senaste vinster</div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            {last3Wins.length ? (
              last3Wins.map((w, idx) => {
                const ev = w.events!;
                const href = `/events/${ev.id}?season=${encodeURIComponent(ev.season_id)}`;
                return (
                  <Link
                    key={`${ev.id}-${idx}`}
                    href={href}
                    className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 last:border-b-0 hover:bg-white/5 transition"
                    title="Öppna tävling"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg">🏆</span>
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {typeLabel(ev.event_type)} — {ev.name}
                        </div>
                        <div className="text-xs text-white/60">{fmtDateShort(ev.starts_at)}</div>
                      </div>
                    </div>

                    <div className="text-sm text-white/70 tabular-nums shrink-0">
                      {fmtInt(Number(w.poang ?? 0))} p
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="px-4 py-4 text-white/60 text-sm">Inga vinster ännu.</div>
            )}
          </div>
        </div>
      </section>

      {/* (Valfritt) Din befintliga historik/sections kan ligga kvar under här.
          Jag lämnar dem ute i denna version så det blir tydligt vad som är nytt.
          Säg till om du vill att jag integrerar troféskåpet i din nuvarande fulla spelarsida utan att ta bort något. */}
    </main>
  );
}