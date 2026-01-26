import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

type Rules = {
  vanlig_best_of: number | null;
  major_best_of: number | null;
  lagtavling_best_of: number | null;

  hcp_zero_max: number | null;
  hcp_two_max: number | null;
  hcp_four_min: number | null;

  final_start_scores: any | null; // jsonb
};

type EventRow = {
  id: string;
  season_id: string;
  event_type: string;
  locked: boolean;
};

type SeasonPlayerRow = {
  id: string; // season_player_id
  hcp: number;
};

type ResultForTotalsRow = {
  season_player_id: string;
  poang: number | null;
  did_not_play: boolean;
  events: { event_type: string; locked: boolean } | null;
};

type Entry = {
  season_player_id: string;
  gross_strokes: number | null;
  did_not_play: boolean;
  override_placing: number | null;
  lag_nr: number | null;
  lag_score: number | null;
};

function safeInt(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

async function parseInput(req: NextRequest): Promise<{ entries: Entry[]; lock?: boolean; unlock?: boolean }> {
  const ct = req.headers.get("content-type") || "";

  if (ct.includes("application/json")) {
    const body = await req.json();
    const raw = (body?.entries ?? []) as any[];

    const entries: Entry[] = raw.map((x) => ({
      season_player_id: String(x.season_player_id),
      gross_strokes: x.gross_strokes === "" || x.gross_strokes == null ? null : safeInt(x.gross_strokes),
      did_not_play: Boolean(x.did_not_play),
      override_placing: x.override_placing === "" || x.override_placing == null ? null : safeInt(x.override_placing),
      lag_nr: x.lag_nr === "" || x.lag_nr == null ? null : safeInt(x.lag_nr),
      lag_score: x.lag_score === "" || x.lag_score == null ? null : safeInt(x.lag_score),
    }));

    return { entries, lock: Boolean(body?.lock), unlock: Boolean(body?.unlock) };
  }

  // FormData fallback
  const form = await req.formData();
  const rawEntries = form.get("entries");

  let parsed: any[] = [];
  try {
    parsed = rawEntries ? JSON.parse(String(rawEntries)) : [];
  } catch {
    parsed = [];
  }

  const entries: Entry[] = (parsed ?? []).map((x: any) => ({
    season_player_id: String(x.season_player_id),
    gross_strokes: x.gross_strokes === "" || x.gross_strokes == null ? null : safeInt(x.gross_strokes),
    did_not_play: Boolean(x.did_not_play),
    override_placing: x.override_placing === "" || x.override_placing == null ? null : safeInt(x.override_placing),
    lag_nr: x.lag_nr === "" || x.lag_nr == null ? null : safeInt(x.lag_nr),
    lag_score: x.lag_score === "" || x.lag_score == null ? null : safeInt(x.lag_score),
  }));

  const lock = form.get("lock") === "true";
  const unlock = form.get("unlock") === "true";

  return { entries, lock, unlock };
}

function hcpToStrokes(hcp: number, rules: Rules): number {
  const zeroMax = Number(rules.hcp_zero_max ?? 10.5);
  const twoMax = Number(rules.hcp_two_max ?? 15.5);
  const fourMin = Number(rules.hcp_four_min ?? 15.6);

  if (hcp <= zeroMax) return 0;
  if (hcp < fourMin && hcp <= twoMax) return 2;
  return 4;
}

function sumTopN(values: number[], n: number): number {
  return values
    .slice()
    .sort((a, b) => b - a)
    .slice(0, n)
    .reduce((acc, v) => acc + v, 0);
}

function defaultFinalStartScores(): number[] {
  // rank 1..8, sista gäller rank 9–12
  return [-10, -8, -6, -5, -4, -3, -2, -1, 0];
}

function finalStartForRank(rank: number, rules: Rules): number {
  const def = defaultFinalStartScores();
  const arr = Array.isArray(rules.final_start_scores) ? rules.final_start_scores : def;

  if (rank >= 1 && rank <= 8) {
    const v = Number(arr[rank - 1]);
    return Number.isFinite(v) ? v : def[rank - 1];
  }
  const last = Number(arr[arr.length - 1]);
  return Number.isFinite(last) ? last : 0;
}

async function getPointsMap(sb: ReturnType<typeof supabaseServer>, eventType: string): Promise<Map<number, number>> {
  // points_table: event_type, placering, poang
  const resp = await sb
    .from("points_table")
    .select("placering,poang,event_type")
    .eq("event_type", eventType);

  if (resp.error) throw new Error(resp.error.message);

  const map = new Map<number, number>();
  for (const r of (resp.data ?? []) as any[]) {
    const pl = Number(r.placering);
    const pts = Number(r.poang);
    if (Number.isFinite(pl)) map.set(pl, Number.isFinite(pts) ? pts : 0);
  }
  return map;
}

function fallbackPoints(eventType: string, placing: number): number {
  const regular = [2000, 1200, 760, 540, 440, 400, 360, 340, 320, 300, 280, 260];
  const major = [4000, 2400, 1520, 1080, 880, 800, 720, 680, 640, 600, 560, 520];
  const team = [2000, 1200, 760, 540, 440, 400];
  const final = new Array(12).fill(0);

  if (eventType === "MAJOR") return major[placing - 1] ?? 0;
  if (eventType === "LAGTÄVLING") return team[placing - 1] ?? 0;
  if (eventType === "FINAL") return final[placing - 1] ?? 0;
  return regular[placing - 1] ?? 0;
}

/**
 * FINAL: Bygger alltid om event_start_scores när man sparar final:
 * - delete where event_id
 * - beräkna total (låsta events, ej FINAL) med best-of
 * - top12 får start_score enligt rules.final_start_scores
 */
async function rebuildFinalStartScores(
  sb: ReturnType<typeof supabaseServer>,
  eventId: string,
  seasonId: string,
  rules: Rules
): Promise<Map<string, number>> {
  const del = await sb.from("event_start_scores").delete().eq("event_id", eventId);
  if (del.error) throw new Error(del.error.message);

  const vanligBest = Number(rules.vanlig_best_of ?? 4);
  const majorBest = Number(rules.major_best_of ?? 3);
  const lagBest = Number(rules.lagtavling_best_of ?? 2);

  const spResp = await sb.from("season_players").select("id").eq("season_id", seasonId);
  if (spResp.error) throw new Error(spResp.error.message);

  const spIds: string[] = (spResp.data ?? []).map((x: any) => String(x.id));

  const resResp = await sb
    .from("results")
    .select("season_player_id,poang,did_not_play,events(event_type,locked)")
    .in("season_player_id", spIds);

  if (resResp.error) throw new Error(resResp.error.message);

  const bySp = new Map<string, { vanlig: number[]; major: number[]; lag: number[] }>();
  for (const id of spIds) bySp.set(id, { vanlig: [], major: [], lag: [] });

  for (const r of (resResp.data ?? []) as any as ResultForTotalsRow[]) {
    if (r?.events?.locked !== true) continue;
    if (r.did_not_play) continue;
    const et = String(r?.events?.event_type ?? "");
    if (et === "FINAL") continue;

    const b = bySp.get(String(r.season_player_id));
    if (!b) continue;

    const pts = Number(r.poang ?? 0);
    if (et === "VANLIG") b.vanlig.push(pts);
    else if (et === "MAJOR") b.major.push(pts);
    else if (et === "LAGTÄVLING") b.lag.push(pts);
  }

  type Tot = { season_player_id: string; total: number };
  const totals: Tot[] = spIds.map((id: string) => {
    const b = bySp.get(id)!;
    const total =
      sumTopN(b.vanlig, vanligBest) +
      sumTopN(b.major, majorBest) +
      sumTopN(b.lag, lagBest);
    return { season_player_id: id, total };
  });

  totals.sort((a: Tot, b: Tot) => b.total - a.total);
  const top12: Tot[] = totals.slice(0, 12);

  const upserts = top12.map((t: Tot, idx: number) => ({
    event_id: eventId,
    season_player_id: t.season_player_id,
    start_score: finalStartForRank(idx + 1, rules),
  }));

  const up = await sb.from("event_start_scores").upsert(upserts, { onConflict: "event_id,season_player_id" });
  if (up.error) throw new Error(up.error.message);

  const map = new Map<string, number>();
  for (const u of upserts) map.set(u.season_player_id, Number(u.start_score));
  return map;
}

export async function POST(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const sb = supabaseServer();
  const { id: eventId } = await ctx.params;

  const { entries, lock, unlock } = await parseInput(req);

  // Event
  const evResp = await sb
    .from("events")
    .select("id,season_id,event_type,locked")
    .eq("id", eventId)
    .single();

  if (evResp.error) return NextResponse.json({ error: evResp.error.message }, { status: 500 });
  const event = evResp.data as EventRow | null;
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const seasonId = String(event.season_id);
  const eventType = String(event.event_type);
  const isTeam = eventType === "LAGTÄVLING";
  const isFinal = eventType === "FINAL";

  // Unlock
  if (unlock) {
    const u = await sb.from("events").update({ locked: false }).eq("id", eventId);
    if (u.error) return NextResponse.json({ error: u.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, locked: false });
  }

  // Rules (incl final_start_scores)
  const rulesResp = await sb
    .from("season_rules")
    .select("vanlig_best_of,major_best_of,lagtavling_best_of,hcp_zero_max,hcp_two_max,hcp_four_min,final_start_scores")
    .eq("season_id", seasonId)
    .single();

  if (rulesResp.error) return NextResponse.json({ error: rulesResp.error.message }, { status: 500 });
  const rules = (rulesResp.data ?? {}) as Rules;

  // points map
  let ptsMap = new Map<number, number>();
  try {
    ptsMap = await getPointsMap(sb, eventType);
  } catch {
    ptsMap = new Map();
  }

  // HCP map
  const spResp = await sb.from("season_players").select("id,hcp").eq("season_id", seasonId);
  if (spResp.error) return NextResponse.json({ error: spResp.error.message }, { status: 500 });

  const spRows = (spResp.data ?? []) as any[] as SeasonPlayerRow[];
  const hcpBySp = new Map<string, number>();
  for (const r of spRows) hcpBySp.set(String(r.id), Number(r.hcp ?? 0));

  // Final startscore map (rebuild always)
  let startScoreMap = new Map<string, number>();
  if (isFinal) {
    try {
      startScoreMap = await rebuildFinalStartScores(sb, eventId, seasonId, rules);
    } catch (e: any) {
      return NextResponse.json({ error: `Final startscore error: ${e?.message ?? e}` }, { status: 500 });
    }
  }

  // Build result rows
  const rows = entries.map((e: Entry) => {
    const hcp = Number(hcpBySp.get(e.season_player_id) ?? 0);
    const hcp_strokes = isTeam ? 0 : hcpToStrokes(hcp, rules);

    const gross = e.gross_strokes;
    const net = gross == null ? null : Math.max(0, gross - hcp_strokes);

    const start = isFinal ? Number(startScoreMap.get(e.season_player_id) ?? 0) : 0;
    const adjusted = isFinal && gross != null ? gross - hcp_strokes + start : null;

    return {
      event_id: eventId,
      season_player_id: e.season_player_id,
      gross_strokes: gross,
      did_not_play: e.did_not_play,
      override_placing: e.override_placing,
      lag_nr: e.lag_nr,
      lag_score: e.lag_score,
      hcp_strokes,
      net_strokes: isTeam || isFinal ? null : net,
      adjusted_score: isFinal ? adjusted : null,
      placering: null as number | null,
      poang: 0,
    };
  });

  // Placement & points
  if (isTeam) {
    const teamMap = new Map<number, { lag_score: number; members: any[] }>();

    for (const r of rows) {
      if (r.did_not_play) continue;
      const nr = r.lag_nr ?? 0;
      const score = r.lag_score ?? null;
      if (!nr || score == null) continue;

      if (!teamMap.has(nr)) teamMap.set(nr, { lag_score: score, members: [] });
      teamMap.get(nr)!.members.push(r);
      teamMap.get(nr)!.lag_score = score;
    }

    const sorted = Array.from(teamMap.entries())
      .map(([lag_nr, v]) => ({ lag_nr, lag_score: v.lag_score, members: v.members }))
      .sort((a, b) => {
        if (a.lag_score !== b.lag_score) return a.lag_score - b.lag_score;
        const minA = Math.min(...a.members.map((m: any) => m.override_placing ?? 999));
        const minB = Math.min(...b.members.map((m: any) => m.override_placing ?? 999));
        return minA - minB;
      });

    for (let i = 0; i < sorted.length; i++) {
      const placing = i + 1;
      const pts = ptsMap.get(placing) ?? fallbackPoints(eventType, placing);
      for (const m of sorted[i].members) {
        m.placering = placing;
        m.poang = pts;
      }
    }
  } else if (isFinal) {
    const playable = rows
      .filter((r) => !r.did_not_play && r.adjusted_score != null)
      .sort((a, b) => {
        const da = Number(a.adjusted_score);
        const db = Number(b.adjusted_score);
        if (da !== db) return da - db;
        const oa = a.override_placing ?? 999;
        const ob = b.override_placing ?? 999;
        return oa - ob;
      });

    for (let i = 0; i < playable.length; i++) {
      const placing = i + 1;
      playable[i].placering = placing;
      playable[i].poang = ptsMap.get(placing) ?? fallbackPoints(eventType, placing);
    }
  } else {
    const playable = rows
      .filter((r) => !r.did_not_play && r.net_strokes != null)
      .sort((a, b) => {
        const na = Number(a.net_strokes);
        const nb = Number(b.net_strokes);
        if (na !== nb) return na - nb;
        const oa = a.override_placing ?? 999;
        const ob = b.override_placing ?? 999;
        return oa - ob;
      });

    for (let i = 0; i < playable.length; i++) {
      const placing = i + 1;
      playable[i].placering = placing;
      playable[i].poang = ptsMap.get(placing) ?? fallbackPoints(eventType, placing);
    }
  }

  // Save results
  const up = await sb.from("results").upsert(rows, { onConflict: "event_id,season_player_id" });
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

  // Lock
  if (lock) {
    const l = await sb.from("events").update({ locked: true }).eq("id", eventId);
    if (l.error) return NextResponse.json({ error: l.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, locked: true });
  }

  return NextResponse.json({ ok: true, locked: Boolean(event.locked) });
}