export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { supabaseServer } from "@/lib/supabase";
import SpinTheWheelClient from "@/components/SpinTheWheelClient";

type PlayerRow = {
  season_player_id: string;
  name: string;
};

export default async function WheelPage() {
  const sb = supabaseServer();

  // current season
  const seasonResp = await sb.from("seasons").select("id").eq("is_current", true).single();
  const seasonId = seasonResp.data?.id as string | undefined;

  if (!seasonId) {
    return (
      <main className="px-4 py-10 max-w-6xl mx-auto">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/80">
          Hittar ingen aktiv säsong (is_current=true).
        </div>
      </main>
    );
  }

  // players in season
  const spResp = await sb
    .from("season_players")
    .select("id, people(name)")
    .eq("season_id", seasonId);

  const players: PlayerRow[] =
    (spResp.data ?? []).map((r: any) => ({
      season_player_id: String(r.id),
      name: String(r.people?.name ?? "Okänd"),
    })) ?? [];

  // sort for nicer checkbox list
  players.sort((a, b) => a.name.localeCompare(b.name, "sv"));

  return (
    <main className="px-4 py-8 max-w-7xl mx-auto">
      <SpinTheWheelClient seasonId={seasonId} players={players} />
    </main>
  );
}