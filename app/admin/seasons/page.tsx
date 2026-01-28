export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";
import AdminSeasonsClient from "@/components/AdminSeasonsClient";

type SeasonRow = { id: string; name: string; created_at: string; is_current: boolean };

type RulesRow = { vanlig_best_of: number; major_best_of: number; lagtavling_best_of: number };

type SPRow = {
  id: string; // season_player_id
  person_id: string;
  people: { name: string; avatar_url: string | null } | null;
};

type EventRow = { id: string; event_type: string; locked: boolean };

type ResRow = { season_player_id: string; event_id: string; poang: number | null; did_not_play: boolean };

function sumTopN(values: number[], n: number) {
  return values
    .slice()
    .sort((a, b) => b - a)
    .slice(0, n)
    .reduce((acc, v) => acc + v, 0);
}

/**
 * Serieledare (för aktuell säsong)
 */
async function computeSeriesLeader(sb: ReturnType<typeof supabaseServer>, seasonId: string) {
  const rulesResp = await sb
    .from("season_rules")
    .select("vanlig_best_of,major_best_of,lagtavling_best_of")
    .eq("season_id", seasonId)
    .single();

  const rules =
    (rulesResp.data as RulesRow | null) ?? ({
      vanlig_best_of: 4,
      major_best_of: 3,
      lagtavling_best_of: 2,
    } as RulesRow);

  const spResp = await sb
    .from("season_players")
    .select("id, person_id, people(name, avatar_url)")
    .eq("season_id", seasonId);

  const sps = (spResp.data ?? []) as any[] as SPRow[];
  if (!sps.length) return null;

  const spIds = sps.map((x) => String(x.id));

  const evResp = await sb.from("events").select("id,event_type,locked").eq("season_id", seasonId);
  const events = (evResp.data ?? []) as any[] as EventRow[];
  const lockedEventIds = events.filter((e) => e.locked).map((e) => String(e.id));
  if (!lockedEventIds.length) return { name: "—", avatar_url: null, total: 0 };

  const typeByEvent = new Map<string, string>();
  for (const e of events) typeByEvent.set(String(e.id), String(e.event_type));

  const resResp = await sb
    .from("results")
    .select("season_player_id,event_id,poang,did_not_play")
    .in("event_id", lockedEventIds)
    .in("season_player_id", spIds);

  const results = (resResp.data ?? []) as any[] as ResRow[];

  const bySp = new Map<string, { vanlig: number[]; major: number[]; lag: number[] }>();
  for (const id of spIds) bySp.set(id, { vanlig: [], major: [], lag: [] });

  for (const r of results) {
    if (r.did_not_play) continue;
    const t = typeByEvent.get(String(r.event_id));
    const b = bySp.get(String(r.season_player_id));
    if (!t || !b) continue;

    const pts = Number(r.poang ?? 0);
    if (t === "VANLIG") b.vanlig.push(pts);
    else if (t === "MAJOR") b.major.push(pts);
    else if (t === "LAGTÄVLING") b.lag.push(pts);
    // FINAL räknas inte i serieledare
  }

  const totals = sps.map((sp) => {
    const b = bySp.get(String(sp.id))!;
    const total =
      sumTopN(b.vanlig, rules.vanlig_best_of) +
      sumTopN(b.major, rules.major_best_of) +
      sumTopN(b.lag, rules.lagtavling_best_of);

    return {
      person_id: String(sp.person_id),
      name: sp.people?.name ?? "Okänd",
      avatar_url: sp.people?.avatar_url ?? null,
      total,
    };
  });

  totals.sort((a, b) => b.total - a.total);
  return totals[0];
}

/**
 * Finalvinnare (för historiska säsonger)
 * - Visa endast om FINAL-event är låst
 * - Annars returnera null (visa ingen spelare)
 */
async function computeFinalWinnerIfLocked(sb: ReturnType<typeof supabaseServer>, seasonId: string) {
  // hitta final-event för säsongen
  const finalResp = await sb
    .from("events")
    .select("id,locked")
    .eq("season_id", seasonId)
    .eq("event_type", "FINAL")
    .limit(1)
    .single();

  const finalEvent = (finalResp.data as any) ?? null;
  if (!finalEvent) return null;
  if (finalEvent.locked !== true) return null; // 👈 kräver låst final

  const finalId = String(finalEvent.id);

  // hämta vinnare (placering 1) på finalen
  const wResp = await sb
    .from("results")
    .select("poang, season_players(person_id, people(name, avatar_url))")
    .eq("event_id", finalId)
    .eq("placering", 1)
    .limit(1)
    .single();

  const row = (wResp.data as any) ?? null;
  if (!row?.season_players?.person_id || !row?.season_players?.people?.name) return null;

  return {
    person_id: String(row.season_players.person_id),
    name: String(row.season_players.people.name),
    avatar_url: (row.season_players.people.avatar_url as string | null) ?? null,
    total: Number(row.poang ?? 0), // visar finalpoäng (om du vill visa blankt kan vi sätta 0)
  };
}

export default async function AdminSeasonsPage() {
  const sb = supabaseServer();

  const seasonsResp = await sb
    .from("seasons")
    .select("id,name,created_at,is_current")
    .order("created_at", { ascending: false });

  const seasons = (seasonsResp.data as SeasonRow[] | null) ?? [];

  // ✅ Sortera säsonger kronologiskt (nyaste först) baserat på namn, t.ex. "2026/2027"
const seasonYear = (name: string) => {
  const m = name.match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : 0;
};

seasons.sort((a, b) => seasonYear(b.name) - seasonYear(a.name));

  // Winner per season:
  // - current: serieledare
  // - inactive: finalvinnare (endast om final låst)
  const winners = await Promise.all(
    seasons.map(async (s) => {
      if (s.is_current) {
        const leader = await computeSeriesLeader(sb, s.id);
        return { season_id: s.id, winner: leader, label: "Ledare (serie)" };
      } else {
        const finalWinner = await computeFinalWinnerIfLocked(sb, s.id);
        return { season_id: s.id, winner: finalWinner, label: "Vinnare (Final)" };
      }
    })
  );

  return (
    <main className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-sm text-white/60">Admin</div>
          <h1 className="text-2xl font-semibold">Säsonger</h1>
          <div className="text-sm text-white/60">
            Skapa ny säsong som inaktiv och byt sedan till aktiv.
          </div>
        </div>
        <Link href="/admin" className="text-sm text-white/70 hover:underline">
          ← Admin
        </Link>
      </div>

      <AdminSeasonsClient seasons={seasons} winners={winners} />
    </main>
  );
}