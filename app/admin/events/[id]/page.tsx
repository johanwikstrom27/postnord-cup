export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";

import AdminEventForm from "@/components/AdminEventForm";
import AdminTeamEventForm from "@/components/AdminTeamEventForm";
import AdminFinalEventForm from "@/components/AdminFinalEventForm";

type EventRow = {
  id: string;
  season_id: string;
  name: string;
  event_type: string; // VANLIG | MAJOR | LAGTÄVLING | FINAL
  locked: boolean;
};

type SeasonPlayerJoinRow = {
  id: string; // season_player_id
  person_id: string;
  hcp: number;
  people: { name: string; avatar_url: string | null } | null;
};

type SeasonPlayerJoinRespRow = {
  id: string;
  person_id: string;
  hcp: number;
  people:
    | { name: string; avatar_url: string | null }
    | Array<{ name: string; avatar_url: string | null }>
    | null;
};

type ResultExistingRow = {
  season_player_id: string;
  gross_strokes: number | null;
  did_not_play: boolean;
  override_placing: number | null;
  lag_nr: number | null;
  lag_score: number | null;
};

type StartScoreRow = {
  season_player_id: string;
  start_score: number;
};

type RulesRow = {
  hcp_zero_max: number | null;
  hcp_two_max: number | null;
  hcp_four_min: number | null;
};

type PlayerForEventForm = {
  season_player_id: string;
  name: string;
  hcp: number;
  existing_gross: number | null;
  existing_dns: boolean;
  existing_override: number | null;
};

type PlayerForTeamForm = {
  season_player_id: string;
  name: string;
  hcp: number;
  existing_dns: boolean;
  existing_lag_nr: number | null;
  existing_lag_score: number | null;
  existing_override?: number | null;
};

type PlayerForFinalForm = {
  season_player_id: string;
  person_id: string;
  name: string;
  hcp: number;
  existing_gross: number | null;
  existing_dns: boolean;
  existing_override?: number | null;
};

type TeamRow = {
  lag_nr: number;
  lag_score: number | null;
  members: string[]; // season_player_id[]
};

export default async function AdminEventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { id: eventId } = await params;
  const sp = await searchParams;
  const seasonQuery = sp?.season ? `?season=${encodeURIComponent(sp.season)}` : "";

  const sb = supabaseServer();

  // 1) Event
  const evResp = await sb
    .from("events")
    .select("id,season_id,name,event_type,locked")
    .eq("id", eventId)
    .single();

  const event = (evResp.data as EventRow | null) ?? null;

  if (!event) {
    return (
      <main className="space-y-4">
        <Link href={`/admin${seasonQuery}`} className="text-sm text-white/70 hover:underline">
          ← Admin
        </Link>
        <div className="text-white/70">Fel: Event not found</div>
      </main>
    );
  }

  const isTeam = event.event_type === "LAGTÄVLING";
  const isFinal = event.event_type === "FINAL";

  // 2) Season players
  const spResp = await sb
    .from("season_players")
    .select("id,person_id,hcp,people(name,avatar_url)")
    .eq("season_id", event.season_id);

  const seasonPlayers = ((spResp.data ?? []) as SeasonPlayerJoinRespRow[]).map((row) => ({
    ...row,
    people: Array.isArray(row.people) ? row.people[0] ?? null : row.people ?? null,
  })) as SeasonPlayerJoinRow[];

  // 3) Existing results for prefill
  const resResp = await sb
    .from("results")
    .select("season_player_id,gross_strokes,did_not_play,override_placing,lag_nr,lag_score")
    .eq("event_id", event.id);

  const existing = (resResp.data ?? []) as ResultExistingRow[];
  const existingBySp = new Map<string, ResultExistingRow>();
  for (const r of existing) existingBySp.set(String(r.season_player_id), r);

  // 4) Build shared data arrays
  const playersEventForm: PlayerForEventForm[] = seasonPlayers.map((p) => {
    const ex = existingBySp.get(p.id);
    return {
      season_player_id: p.id,
      name: p.people?.name ?? "Okänd",
      hcp: Number(p.hcp ?? 0),
      existing_gross: ex?.gross_strokes ?? null,
      existing_dns: ex?.did_not_play ?? false,
      existing_override: ex?.override_placing ?? null,
    };
  });

  const playersTeamForm: PlayerForTeamForm[] = seasonPlayers.map((p) => {
    const ex = existingBySp.get(p.id);
    return {
      season_player_id: p.id,
      name: p.people?.name ?? "Okänd",
      hcp: Number(p.hcp ?? 0),
      existing_dns: ex?.did_not_play ?? false,
      existing_lag_nr: ex?.lag_nr ?? null,
      existing_lag_score: ex?.lag_score ?? null,
      existing_override: ex?.override_placing ?? null,
    };
  });

  const playersFinalForm: PlayerForFinalForm[] = seasonPlayers.map((p) => {
    const ex = existingBySp.get(p.id);
    return {
      season_player_id: p.id,
      person_id: p.person_id,
      name: p.people?.name ?? "Okänd",
      hcp: Number(p.hcp ?? 0),
      existing_gross: ex?.gross_strokes ?? null,
      existing_dns: ex?.did_not_play ?? false,
      existing_override: ex?.override_placing ?? null,
    };
  });

  // 5) initialTeams from existing results
  const teamMap = new Map<number, TeamRow>();

  for (const p of playersTeamForm) {
    const nr = p.existing_lag_nr;
    if (!nr) continue;

    if (!teamMap.has(nr)) {
      teamMap.set(nr, {
        lag_nr: nr,
        lag_score: p.existing_lag_score ?? null,
        members: [],
      });
    }

    const t = teamMap.get(nr)!;
    t.members.push(p.season_player_id);
    if (p.existing_lag_score != null) t.lag_score = p.existing_lag_score;
  }

  const initialTeams: TeamRow[] = Array.from(teamMap.values()).sort((a, b) => a.lag_nr - b.lag_nr);

  // 6) startScores for final
  let startScores: StartScoreRow[] = [];
  if (isFinal) {
    const ssResp = await sb
      .from("event_start_scores")
      .select("season_player_id,start_score")
      .eq("event_id", event.id);

    startScores = (ssResp.data ?? []) as StartScoreRow[];
  }

  const rulesResp = await sb
    .from("season_rules")
    .select("hcp_zero_max,hcp_two_max,hcp_four_min")
    .eq("season_id", event.season_id)
    .single();

  const hcpRules: RulesRow = {
    hcp_zero_max: rulesResp.data?.hcp_zero_max ?? null,
    hcp_two_max: rulesResp.data?.hcp_two_max ?? null,
    hcp_four_min: rulesResp.data?.hcp_four_min ?? null,
  };

  return (
    <main className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={`/admin${seasonQuery}`}
          className="inline-flex items-center gap-2 text-sm text-white/70 transition hover:text-white"
        >
          <span>←</span>
          <span>Admin</span>
        </Link>

        <Link
          href={`/events/${event.id}${seasonQuery}`}
          className="inline-flex items-center gap-2 text-sm text-white/70 transition hover:text-white"
        >
          <span>Öppna publika sidan</span>
          <span>→</span>
        </Link>
      </div>

      <section className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.16)] md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-white/45">Admin • Resultat</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{event.name}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75">
                Typ: {event.event_type}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75">
                Resultatvy
              </span>
            </div>
          </div>

          <div
            className={`inline-flex h-fit rounded-full border px-3 py-1 text-sm ${
              event.locked
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-white/15 bg-white/5 text-white/80"
            }`}
          >
            {event.locked ? "Låst" : "Upplåst"}
          </div>
        </div>

        <p className="mt-5 max-w-2xl text-sm leading-6 text-white/65">
          Resultaten kan sparas som utkast innan du låser tävlingen. När du låser får du nu en tydlig
          förhandsgranskning så att du kan verifiera placeringar innan notiser går ut.
        </p>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_16px_60px_rgba(0,0,0,0.16)] md:p-6">
        {isFinal ? (
          <AdminFinalEventForm
            eventId={event.id}
            eventName={event.name}
            isLocked={event.locked}
            players={playersFinalForm}
            startScores={startScores}
            hcpRules={hcpRules}
          />
        ) : isTeam ? (
          <AdminTeamEventForm
            eventId={event.id}
            eventName={event.name}
            isLocked={event.locked}
            players={playersTeamForm}
            initialTeams={initialTeams}
          />
        ) : (
          <AdminEventForm
            eventId={event.id}
            eventName={event.name}
            eventType={event.event_type}
            locked={event.locked}
            players={playersEventForm}
            hcpRules={hcpRules}
          />
        )}
      </section>
    </main>
  );
}
