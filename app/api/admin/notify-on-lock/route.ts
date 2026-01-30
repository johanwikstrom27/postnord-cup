export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { sendToSubscribers } from "@/lib/push";

function typeLabel(t: string) {
  if (t === "VANLIG") return "Vanlig";
  if (t === "MAJOR") return "Major";
  if (t === "LAGTÄVLING") return "Lagtävling";
  if (t === "FINAL") return "Final";
  return t;
}

async function computeLeader(sb: ReturnType<typeof supabaseServer>, seasonId: string) {
  const rulesResp = await sb
    .from("season_rules")
    .select("vanlig_best_of,major_best_of,lagtavling_best_of")
    .eq("season_id", seasonId)
    .single();

  const rules = (rulesResp.data as any) ?? { vanlig_best_of: 4, major_best_of: 3, lagtavling_best_of: 2 };

  const spResp = await sb
    .from("season_players")
    .select("id,person_id,people(name)")
    .eq("season_id", seasonId);

  const players = (spResp.data ?? []) as any[];
  const spIds = players.map((p) => p.id);

  const evResp = await sb.from("events").select("id,event_type,locked").eq("season_id", seasonId);
  const events = (evResp.data ?? []) as any[];
  const lockedIds = events.filter((e) => e.locked).map((e) => e.id);

  const typeByEvent = new Map<string, string>();
  for (const e of events) typeByEvent.set(e.id, e.event_type);

  const resResp = await sb
    .from("results")
    .select("season_player_id,event_id,poang,did_not_play")
    .in("event_id", lockedIds)
    .in("season_player_id", spIds);

  const results = (resResp.data ?? []) as any[];

  const bySp = new Map<string, { vanlig: number[]; major: number[]; lag: number[] }>();
  for (const p of players) bySp.set(p.id, { vanlig: [], major: [], lag: [] });

  for (const r of results) {
    if (r.did_not_play) continue;
    const t = typeByEvent.get(r.event_id);
    if (!t || t === "FINAL") continue;
    const b = bySp.get(r.season_player_id);
    if (!b) continue;
    const pts = Number(r.poang ?? 0);
    if (t === "VANLIG") b.vanlig.push(pts);
    else if (t === "MAJOR") b.major.push(pts);
    else if (t === "LAGTÄVLING") b.lag.push(pts);
  }

  const sumTopN = (arr: number[], n: number) =>
    arr.slice().sort((a, b) => b - a).slice(0, n).reduce((acc, v) => acc + v, 0);

  const totals = players.map((p) => {
    const b = bySp.get(p.id)!;
    const total =
      sumTopN(b.vanlig, Number(rules.vanlig_best_of ?? 4)) +
      sumTopN(b.major, Number(rules.major_best_of ?? 3)) +
      sumTopN(b.lag, Number(rules.lagtavling_best_of ?? 2));
    return { person_id: p.person_id, name: p.people?.name ?? "Okänd", total };
  });

  totals.sort((a, b) => b.total - a.total);
  return totals[0] ?? null;
}

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  const got = req.headers.get("x-cron-secret") || "";
  if (!secret || got !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = supabaseServer();
  const body = await req.json().catch(() => ({}));
  const eventId = String(body?.event_id ?? "");
  if (!eventId) return NextResponse.json({ error: "Missing event_id" }, { status: 400 });

  const ev = await sb
    .from("events")
    .select("id,season_id,name,event_type,course,locked")
    .eq("id", eventId)
    .single();

  const event = ev.data as any;
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.locked !== true) return NextResponse.json({ ok: true, skipped: "not locked" });

  const seasonId = String(event.season_id);
  const origin = process.env.APP_ORIGIN || "http://localhost:3000";
  const eventUrl = `${origin}/events/${eventId}?season=${encodeURIComponent(seasonId)}`;

  // winners (placering 1). Team: två vinnare.
  const wResp = await sb
    .from("results")
    .select("placering, season_players(person_id, people(name))")
    .eq("event_id", eventId)
    .eq("placering", 1);

  const winners = (wResp.data ?? []) as any[];
  const names = winners
    .map((r) => r.season_players?.people?.name)
    .filter(Boolean)
    .slice(0, event.event_type === "LAGTÄVLING" ? 2 : 1) as string[];

  const winnerText = names.length >= 2 ? `${names[0]} & ${names[1]}` : names[0] ?? "Vinnare";
  const course = event.course ?? event.name;
  const format = typeLabel(String(event.event_type));

  // results notification (always on lock)
  await sendToSubscribers("results", {
    title: `🥇 ${winnerText} vinner på ${course} – ${format}`,
    body: "Resultat publicerat i appen",
    url: eventUrl,
  });

  // leader notification only if changed
  const leader = await computeLeader(sb, seasonId);
  if (leader?.person_id) {
    const seasonResp = await sb
      .from("seasons")
      .select("last_notified_leader_person_id")
      .eq("id", seasonId)
      .single();

    const prev = (seasonResp.data as any)?.last_notified_leader_person_id ?? null;

    if (String(prev ?? "") !== String(leader.person_id)) {
      const homeUrl = `${origin}/?season=${encodeURIComponent(seasonId)}`;
      await sendToSubscribers("leader", {
        title: "🚨 Ny serieledare 🚨",
        body: `${leader.name} 🔥`,
        url: homeUrl,
      });
      await sb.from("seasons").update({ last_notified_leader_person_id: leader.person_id }).eq("id", seasonId);
    }
  }

  return NextResponse.json({ ok: true });
}