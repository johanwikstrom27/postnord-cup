export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { supabaseServer } from "@/lib/supabase";
import SpinTheWheelClient from "@/components/SpinTheWheelClient";
import { resolvePublicSeason } from "@/lib/publicSeason";

type PlayerRow = {
  season_player_id: string;
  name: string;
  avatar_url: string | null;
};

type PersonRow = { name: string; avatar_url: string | null };

type PlayerRespRow = {
  id: string;
  people: PersonRow | PersonRow[] | null;
};

export default async function WheelPage() {
  const sb = supabaseServer();

  const season = await resolvePublicSeason(sb, null);
  const seasonId = season?.id;

  if (!seasonId) {
    return (
      <main className="px-4 py-10 max-w-6xl mx-auto">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/80">
          Hittar ingen publicerad säsong.
        </div>
      </main>
    );
  }

  // players in season
  const spResp = await sb
    .from("season_players")
    .select("id, people(name,avatar_url)")
    .eq("season_id", seasonId);

  const players: PlayerRow[] =
    ((spResp.data ?? []) as PlayerRespRow[]).map((r) => {
      const person = Array.isArray(r.people) ? r.people[0] ?? null : r.people ?? null;

      return {
        season_player_id: String(r.id),
        name: String(person?.name ?? "Okänd"),
        avatar_url: person?.avatar_url ?? null,
      };
    });

  // sort for nicer checkbox list
  players.sort((a, b) => a.name.localeCompare(b.name, "sv"));

  return (
    <main className="px-4 py-8 max-w-7xl mx-auto">
      <SpinTheWheelClient seasonId={seasonId} players={players} />
    </main>
  );
}
