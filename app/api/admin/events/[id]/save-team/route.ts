import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

type TeamInput = {
  lag_nr: number;               // 1..6
  player_a: string | null;      // season_player_id (valfri)
  player_b: string | null;      // season_player_id (valfri)
  lag_score: number | null;     // lagets bruttoslag (krävs om minst 1 spelare)
};

function rankTeams(teams: Array<{ lag_nr: number; score: number }>) {
  // lagplacering: 1,2,2,4...
  const eligible = teams.slice().sort((a, b) => a.score - b.score);
  const place = new Map<number, number>();

  let current = 1;
  for (let i = 0; i < eligible.length; i++) {
    if (i > 0 && eligible[i].score !== eligible[i - 1].score) current = i + 1;
    place.set(eligible[i].lag_nr, current);
  }
  return place;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await ctx.params;
  const sb = supabaseServer();

  const body = await req.json();
  const teams: TeamInput[] = body.teams ?? [];
  const lockState: boolean | null =
    typeof body.lock_state === "boolean" ? body.lock_state : null;

  // 1) Läs event (måste vara LAGTÄVLING)
  const eventResp = await sb
    .from("events")
    .select("id, season_id, event_type")
    .eq("id", eventId)
    .single();

  if (eventResp.error || !eventResp.data) {
    return NextResponse.json({ error: "Tävlingen hittades inte." }, { status: 400 });
  }

  const seasonId = eventResp.data.season_id as string;
  const eventType = eventResp.data.event_type as string;

  if (eventType !== "LAGTÄVLING") {
    return NextResponse.json({ error: "Denna endpoint är bara för LAGTÄVLING." }, { status: 400 });
  }

  // 2) Normalisera lag (tillåt 0, 1 eller 2 spelare)
  const activeTeams = teams
    .map((t) => {
      const members = [t.player_a, t.player_b].filter(Boolean) as string[];
      return { ...t, members };
    })
    .filter((t) => t.members.length > 0);

  // Validera: lag_score krävs om laget har minst 1 spelare
  for (const t of activeTeams) {
    if (t.lag_score === null || Number.isNaN(t.lag_score)) {
      return NextResponse.json({ error: `Lag ${t.lag_nr}: fyll i lagets bruttoslag.` }, { status: 400 });
    }
  }

  // Validera: ingen spelare får vara med i fler än ett lag
  const allPlayers = activeTeams.flatMap((t) => t.members);
  const seen = new Set<string>();
  for (const pid of allPlayers) {
    if (seen.has(pid)) {
      return NextResponse.json({ error: "En spelare är vald i fler än ett lag." }, { status: 400 });
    }
    seen.add(pid);
  }

  // Validera: samma spelare två gånger i samma lag
  for (const t of activeTeams) {
    if (t.members.length === 2 && t.members[0] === t.members[1]) {
      return NextResponse.json({ error: `Lag ${t.lag_nr}: samma spelare vald två gånger.` }, { status: 400 });
    }
  }

  // 3) Hämta poängtabell för LAGTÄVLING (per spelare)
  // Endast placering 1..6 finns normalt. Saknas placering => 0 poäng.
  const ptsResp = await sb
    .from("points_table")
    .select("placering, poang")
    .eq("season_id", seasonId)
    .eq("event_type", "LAGTÄVLING");

  if (ptsResp.error) {
    return NextResponse.json({ error: ptsResp.error.message }, { status: 400 });
  }

  const ptsMap = new Map<number, number>();
  for (const p of (ptsResp.data ?? []) as any[]) {
    ptsMap.set(Number(p.placering), Number(p.poang));
  }

  // 4) Ranka lag (bara aktiva lag)
  const placementByTeam = rankTeams(
    activeTeams.map((t) => ({ lag_nr: t.lag_nr, score: t.lag_score as number }))
  );

  // 5) Skriv results för spelarna i lagen
  const upserts: any[] = [];

  for (const t of activeTeams) {
    const placing = placementByTeam.get(t.lag_nr) ?? null;
    const points = placing ? (ptsMap.get(placing) ?? 0) : 0;

    for (const spid of t.members) {
      upserts.push({
        event_id: eventId,
        season_player_id: spid,

        // Lagtävling: vi använder lag_score, inte individuellt brutto/net
        gross_strokes: null,
        net_strokes: null,
        adjusted_score: null,

        // HCP ignoreras i lagtävling
        hcp_strokes: 0,

        // lagdata
        lag_nr: t.lag_nr,
        lag_score: t.lag_score,

        // placering/poäng per lag
        placering: placing,
        poang: points,

        did_not_play: false,
        disqualified: false,
        placering_override: null,
      });
    }
  }

  const upResp = await sb.from("results").upsert(upserts, {
    onConflict: "event_id,season_player_id",
  });

  if (upResp.error) {
    return NextResponse.json({ error: upResp.error.message }, { status: 400 });
  }

  // 6) Lås/lås upp om begärt
  if (lockState !== null) {
    const lockResp = await sb.from("events").update({ locked: lockState }).eq("id", eventId);
    if (lockResp.error) {
      return NextResponse.json({ error: lockResp.error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}