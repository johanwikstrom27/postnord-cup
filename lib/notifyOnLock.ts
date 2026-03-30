import { supabaseServer } from "@/lib/supabase";
import { sendToSubscribers } from "@/lib/push";
import { areNotificationsPaused } from "@/lib/notificationPause";

type RulesRow = {
  vanlig_best_of: number | null;
  major_best_of: number | null;
  lagtavling_best_of: number | null;
};

type PlayerRespRow = {
  id: string;
  person_id: string;
  people: { name: string } | Array<{ name: string }> | null;
};

type EventRespRow = {
  id: string;
  event_type: string;
  locked: boolean;
};

type ResultRespRow = {
  season_player_id: string;
  event_id: string;
  poang: number | null;
  did_not_play: boolean;
};

type EventDetailRow = {
  id: string;
  season_id: string;
  name: string;
  event_type: string;
  course: string | null;
  locked: boolean;
};

type WinnerRespRow = {
  placering: number | null;
  season_players:
    | { person_id: string; people: { name: string } | Array<{ name: string }> | null }
    | Array<{ person_id: string; people: { name: string } | Array<{ name: string }> | null }>
    | null;
};

type LeaderStateRow = {
  last_notified_leader_person_id: string | null;
};

function typeLabel(t: string) {
  if (t === "VANLIG") return "Vanlig";
  if (t === "MAJOR") return "Major";
  if (t === "LAGTÄVLING") return "Lagtävling";
  if (t === "FINAL") return "Final";
  return t;
}

function getOrigin() {
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function computeLeader(sb: ReturnType<typeof supabaseServer>, seasonId: string) {
  const rulesResp = await sb
    .from("season_rules")
    .select("vanlig_best_of,major_best_of,lagtavling_best_of")
    .eq("season_id", seasonId)
    .single();

  const rules = (rulesResp.data as RulesRow | null) ?? { vanlig_best_of: 4, major_best_of: 3, lagtavling_best_of: 2 };

  const spResp = await sb
    .from("season_players")
    .select("id,person_id,people(name)")
    .eq("season_id", seasonId);

  const players = (spResp.data ?? []) as PlayerRespRow[];
  const spIds = players.map((p) => p.id);

  const evResp = await sb.from("events").select("id,event_type,locked").eq("season_id", seasonId);
  const events = (evResp.data ?? []) as EventRespRow[];
  const lockedIds = events.filter((e) => e.locked).map((e) => e.id);

  const typeByEvent = new Map<string, string>();
  for (const e of events) typeByEvent.set(e.id, e.event_type);

  const resResp = await sb
    .from("results")
    .select("season_player_id,event_id,poang,did_not_play")
    .in("event_id", lockedIds)
    .in("season_player_id", spIds);

  const results = (resResp.data ?? []) as ResultRespRow[];

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
    const person = Array.isArray(p.people) ? p.people[0] ?? null : p.people ?? null;
    return { person_id: p.person_id, name: person?.name ?? "Okänd", total };
  });

  totals.sort((a, b) => b.total - a.total);
  return totals[0] ?? null;
}

export async function notifyOnEventLocked(eventId: string) {
  const sb = supabaseServer();
  if (await areNotificationsPaused(sb)) return;

  const ev = await sb
    .from("events")
    .select("id,season_id,name,event_type,course,locked")
    .eq("id", eventId)
    .single();

  const event = (ev.data as EventDetailRow | null) ?? null;
  if (!event || event.locked !== true) return;

  const seasonId = String(event.season_id);
  const origin = getOrigin();

  const eventUrl = `${origin}/events/${eventId}?season=${encodeURIComponent(seasonId)}`;
  const homeUrl = `${origin}/?season=${encodeURIComponent(seasonId)}`;

  // winners (placering 1)
  const wResp = await sb
    .from("results")
    .select("placering, season_players(person_id, people(name))")
    .eq("event_id", eventId)
    .eq("placering", 1);

  const winners = (wResp.data ?? []) as WinnerRespRow[];
  const names = winners
    .map((r) => {
      const seasonPlayer = Array.isArray(r.season_players) ? r.season_players[0] ?? null : r.season_players ?? null;
      const person = seasonPlayer?.people
        ? Array.isArray(seasonPlayer.people)
          ? seasonPlayer.people[0] ?? null
          : seasonPlayer.people
        : null;
      return person?.name ?? null;
    })
    .filter(Boolean)
    .slice(0, event.event_type === "LAGTÄVLING" ? 2 : 1) as string[];

  const winnerText = names.length >= 2 ? `${names[0]} & ${names[1]}` : names[0] ?? null;
  const course = event.course ?? event.name;
  const format = typeLabel(String(event.event_type));
  const title = winnerText
    ? `🥇 ${winnerText} vinner på ${course} – ${format}`
    : `🥇 Resultat klara på ${course} – ${format}`;

  await sendToSubscribers("results", {
    title,
    body: "Resultat publicerat i appen",
    url: eventUrl,
  });

  // leader only if changed
  const leader = await computeLeader(sb, seasonId);
  if (leader?.person_id) {
    const seasonResp = await sb
      .from("seasons")
      .select("last_notified_leader_person_id")
      .eq("id", seasonId)
      .single();

    const prev = (seasonResp.data as LeaderStateRow | null)?.last_notified_leader_person_id ?? null;

    if (String(prev ?? "") !== String(leader.person_id)) {
      await sendToSubscribers("leader", {
        title: "🚨 Ny serieledare 🚨",
        body: `${leader.name} 🔥`,
        url: homeUrl,
      });

      await sb
        .from("seasons")
        .update({ last_notified_leader_person_id: leader.person_id })
        .eq("id", seasonId);
    }
  }
}
