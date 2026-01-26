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

  const seasonPlayers = (spResp.data ?? []) as any[] as SeasonPlayerJoinRow[];

  // 3) Existing results for prefill
  const resResp = await sb
    .from("results")
    .select("season_player_id,gross_strokes,did_not_play,override_placing,lag_nr,lag_score")
    .eq("event_id", event.id);

  const existing = (resResp.data ?? []) as any[] as ResultExistingRow[];
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

    startScores = (ssResp.data ?? []) as any[] as StartScoreRow[];
  }

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href={`/admin${seasonQuery}`} className="text-sm text-white/70 hover:underline">
          ← Admin
        </Link>

        <Link href={`/events/${event.id}${seasonQuery}`} className="text-sm text-white/70 hover:underline">
          Öppna publika sidan →
        </Link>
      </div>

      {/* Header */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-white/60">Admin</div>
            <h1 className="text-3xl font-semibold">{event.name}</h1>
            <div className="text-white/60">Typ: {event.event_type}</div>
          </div>

          <div
            className={`rounded-full border px-3 py-1 text-sm ${
              event.locked
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-white/15 bg-white/5 text-white/80"
            }`}
          >
            {event.locked ? "Låst" : "Upplåst"}
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        {isFinal ? (
          <AdminFinalEventForm
            eventId={event.id}
            eventName={event.name}
            isLocked={event.locked}
            players={playersFinalForm}
            startScores={startScores}
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
            eventType={event.event_type}
            locked={event.locked}
            players={playersEventForm}
          />
        )}
      </section>
    </main>
  );
}