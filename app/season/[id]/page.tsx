export const runtime = "nodejs";

import HomePage from "@/app/page";
import { supabaseServer } from "@/lib/supabase";

type SeasonRow = { id: string; name: string; created_at: string };

export default async function SeasonViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Skriv om URL-parametern till searchParams som din "season-aware" sidor använder
  // MEN vi vill inte ändra HomePage om du just gjorde den "always latest".
  // Därför: vi visar istället en länk-hub som skickar dig till säsongens leaderboard/events/players.

  const sb = supabaseServer();
  const seasonResp = await sb
    .from("seasons")
    .select("id,name,created_at")
    .eq("id", id)
    .single();

  const season = (seasonResp.data as SeasonRow | null) ?? null;
  if (!season) return <div className="text-white/70">Säsongen hittades inte.</div>;

  const seasonQuery = `?season=${encodeURIComponent(season.id)}`;

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="text-sm text-white/60">Historik</div>
        <h1 className="text-3xl font-semibold tracking-tight">{season.name}</h1>
        <p className="mt-2 text-sm text-white/70">
          Du tittar på en historisk säsong. Hem-sidan visar alltid senaste säsongen.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`/leaderboard${seasonQuery}`}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            Leaderboard →
          </a>
          <a
            href={`/events${seasonQuery}`}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            Tävlingar →
          </a>
          <a
            href={`/players${seasonQuery}`}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            Spelare →
          </a>
        </div>
      </section>
    </main>
  );
}