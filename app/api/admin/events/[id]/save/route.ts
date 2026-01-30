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

  // ✅ detta är särspelsfältet i din DB: results.override_placing
  override_placing: number | null;

  lag_nr: number | null;
  lag_score: number | null;
};

function safeInt(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function pickOverride(x: any): number | null {
  // stöd flera nycklar från klienten
  const v = x?.override_placing ?? x?.placering_override ?? x?.placing_override ?? null;
  return v === "" || v == null ? null : safeInt(v);
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
      override_placing: pickOverride(x),
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
    override_placing: pickOverride(x),
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

async function getPointsMap(sb: ReturnType<typeof supabaseServer>, seasonId: string, eventType: string): Promise<Map<number, number>> {
  const resp = await sb
    .from("points_table")
    .select("placering,poang")
    .eq("season_id", seasonId)
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
 * ✅ Ties + särspel
 * - score-grupper (netto/adjusted)
 * - override_placing = placering inom gruppen (1/2/2...)
 * - om bara vinnaren har override=1 och andra saknar => de blir "2" automatiskt
 * - nästa score-grupp börjar groupStart + groupSize => 1,2,2,4...
 */
function assignPlacingsByScore<T extends { override_placing: number | null; placering: number | null; poang: number }>(
  sorted: T[],
  scoreOf: (r: T) => number,
  pointsFor: (placing: number) => number
) {
  let groupStart = 1;
  let i = 0;

  while (i < sorted.length) {
    const score = scoreOf(sorted[i]);

    const group: T[] = [];
    let j = i;
    while (j < sorted.length && scoreOf(sorted[j]) === score) {
      group.push(sorted[j]);
      j++;
    }

    // största override i gruppen
    let maxOv = 0;
    for (const r of group) {
      const ov = r.override_placing;
      if (typeof ov === "number" && Number.isFinite(ov) && ov > maxOv) maxOv = ov;
    }

    for (const r of group) {
      const ov = r.override_placing;

      // placering inom gruppen:
      // - om override anges => använd den
      // - annars => hamnar direkt efter max override i gruppen (ex: vinnare=1 => andra=2)
      const within =
        typeof ov === "number" && Number.isFinite(ov) && ov > 0
          ? ov
          : Math.max(1, maxOv + 1);

      const placing = groupStart + (within - 1);
      r.placering = placing;
      r.poang = pointsFor(placing);
    }

    groupStart += group.length;
    i = j;
  }
}

/**
 * FINAL startscore rebuild (samma som du haft)
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

  const totals = spIds.map((id) => {
    const b = bySp.get(id)!;
    const total =
      sumTopN(b.vanlig, vanligBest) +
      sumTopN(b.major, majorBest) +
      sumTopN(b.lag, lagBest);
    return { season_player_id: id, total };
  });

  totals.sort((a, b) => b.total - a.total);
  const top12 = totals.slice(0, 12);

  const upserts = top12.map((t, idx) => ({
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
  const evResp = await sb.from("events").select("id,season_id,event_type,locked").eq("id", eventId).single();
  if (evResp.error) return NextResponse.json({ error: evResp.error.message }, { status: 500 });

  const event = evResp.data as EventRow | null;
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const seasonId = String(event.season_id);
  const eventType = String(event.event_type);
  const isFinal = eventType === "FINAL";

  // Unlock
  if (unlock) {
    const u = await sb.from("events").update({ locked: false }).eq("id", eventId);
    if (u.error) return NextResponse.json({ error: u.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, locked: false });
  }

  // Rules
  const rulesResp = await sb
    .from("season_rules")
    .select("vanlig_best_of,major_best_of,lagtavling_best_of,hcp_zero_max,hcp_two_max,hcp_four_min,final_start_scores")
    .eq("season_id", seasonId)
    .single();

  if (rulesResp.error) return NextResponse.json({ error: rulesResp.error.message }, { status: 500 });
  const rules = (rulesResp.data ?? {}) as Rules;

  // Points
  let ptsMap = new Map<number, number>();
  try {
    ptsMap = await getPointsMap(sb, seasonId, eventType);
  } catch {
    ptsMap = new Map();
  }
  const pointsFor = (pl: number) => ptsMap.get(pl) ?? fallbackPoints(eventType, pl);

  // HCP map
  const spResp = await sb.from("season_players").select("id,hcp").eq("season_id", seasonId);
  if (spResp.error) return NextResponse.json({ error: spResp.error.message }, { status: 500 });

  const spRows = (spResp.data ?? []) as any[] as SeasonPlayerRow[];
  const hcpBySp = new Map<string, number>();
  for (const r of spRows) hcpBySp.set(String(r.id), Number(r.hcp ?? 0));

  // Final startscores
  let startScoreMap = new Map<string, number>();
  if (isFinal) {
    try {
      startScoreMap = await rebuildFinalStartScores(sb, eventId, seasonId, rules);
    } catch (e: any) {
      return NextResponse.json({ error: `Final startscore error: ${e?.message ?? e}` }, { status: 500 });
    }
  }

  // Build rows (IMPORTANT: save override_placing + placering_override)
  const rows = entries.map((e) => {
    const hcp = Number(hcpBySp.get(e.season_player_id) ?? 0);
    const hcp_strokes = hcpToStrokes(hcp, rules);

    const gross = e.gross_strokes;
    const net = gross == null ? null : Math.max(0, gross - hcp_strokes);

    const start = isFinal ? Number(startScoreMap.get(e.season_player_id) ?? 0) : 0;
    const adjusted = isFinal && gross != null ? gross - hcp_strokes + start : null;

    return {
      event_id: eventId,
      season_player_id: e.season_player_id,
      gross_strokes: gross,
      did_not_play: e.did_not_play,

      // ✅ the one you actually have (and your UI reads)
      override_placing: e.override_placing,
      // ✅ also keep your legacy column
      placering_override: e.override_placing,

      hcp_strokes,
      net_strokes: isFinal ? null : net,
      adjusted_score: isFinal ? adjusted : null,

      placering: null as number | null,
      poang: 0,
      disqualified: false,

      // team fields are irrelevant here but keep schema safe
      lag_nr: e.lag_nr ?? null,
      lag_score: e.lag_score ?? null,
    };
  });

  // Calculate placings/points
  if (isFinal) {
    const playable = rows
      .filter((r) => !r.did_not_play && r.adjusted_score != null)
      .sort((a, b) => Number(a.adjusted_score) - Number(b.adjusted_score) || (a.override_placing ?? 999) - (b.override_placing ?? 999));

    assignPlacingsByScore(playable as any, (r: any) => Number(r.adjusted_score), pointsFor);
  } else {
    const playable = rows
      .filter((r) => !r.did_not_play && r.net_strokes != null)
      .sort((a, b) => Number(a.net_strokes) - Number(b.net_strokes) || (a.override_placing ?? 999) - (b.override_placing ?? 999));

    assignPlacingsByScore(playable as any, (r: any) => Number(r.net_strokes), pointsFor);
  }

  // Persist
  const up = await sb.from("results").upsert(rows, { onConflict: "event_id,season_player_id" });
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

  // Lock if requested
  if (lock) {
    const l = await sb.from("events").update({ locked: true }).eq("id", eventId);
    if (l.error) return NextResponse.json({ error: l.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, locked: true });
  }

  return NextResponse.json({ ok: true, locked: Boolean(event.locked) });
}