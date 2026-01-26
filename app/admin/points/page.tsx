export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";

type SeasonRow = { id: string; name: string; created_at: string };
type RulesRow = { season_id: string; final_start_scores: any };
type PointsRow = { event_type: string; placering: number; poang: number };

async function resolveSeason(sb: ReturnType<typeof supabaseServer>, requestedSeasonId: string | null) {
  if (requestedSeasonId) {
    const r = await sb.from("seasons").select("id,name,created_at").eq("id", requestedSeasonId).single();
    if (r.data) return r.data as SeasonRow;
  }

  const cur = await sb.from("seasons").select("id,name,created_at").eq("is_current", true).limit(1).single();
  if (cur.data) return cur.data as SeasonRow;

  const latest = await sb.from("seasons").select("id,name,created_at").order("created_at", { ascending: false }).limit(1).single();
  return (latest.data as SeasonRow) ?? null;
}

function defFinalArr() {
  return [-10, -8, -6, -5, -4, -3, -2, -1, 0];
}

function defPoints(type: string) {
  const regular = [2000, 1200, 760, 540, 440, 400, 360, 340, 320, 300, 280, 260];
  const major = [4000, 2400, 1520, 1080, 880, 800, 720, 680, 640, 600, 560, 520];
  const lag = [2000, 1200, 760, 540, 440, 400];
  const fin = new Array(12).fill(0);

  if (type === "MAJOR") return major;
  if (type === "LAGTÄVLING") return lag;
  if (type === "FINAL") return fin;
  return regular;
}

export default async function AdminPointsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const sb = supabaseServer();
  const sp = await searchParams;

  const season = await resolveSeason(sb, sp?.season ?? null);
  if (!season) return <div className="text-white/70">Ingen säsong hittades.</div>;

  const seasonQuery = `?season=${encodeURIComponent(season.id)}`;

  // points_table
  const ptsResp = await sb.from("points_table").select("event_type,placering,poang");
  const ptsRows = (ptsResp.data ?? []) as any[] as PointsRow[];

  const map = new Map<string, Map<number, number>>();
  for (const r of ptsRows) {
    const t = String(r.event_type);
    if (!map.has(t)) map.set(t, new Map());
    map.get(t)!.set(Number(r.placering), Number(r.poang));
  }

  const getPts = (t: string, pl: number) => {
    const v = map.get(t)?.get(pl);
    if (typeof v === "number" && Number.isFinite(v)) return v;
    return defPoints(t)[pl - 1] ?? 0;
  };

  // final startscore array i season_rules
  const rulesResp = await sb
    .from("season_rules")
    .select("season_id,final_start_scores")
    .eq("season_id", season.id)
    .single();

  const rules = (rulesResp.data as RulesRow | null) ?? null;
  const arr = Array.isArray(rules?.final_start_scores) ? rules!.final_start_scores : defFinalArr();

  const f = (i: number, fallback: number) => {
    const n = Number(arr?.[i]);
    return Number.isFinite(n) ? n : fallback;
  };

  const r1 = f(0, -10);
  const r2 = f(1, -8);
  const r3 = f(2, -6);
  const r4 = f(3, -5);
  const r5 = f(4, -4);
  const r6 = f(5, -3);
  const r7 = f(6, -2);
  const r8 = f(7, -1);
  const r9 = Number(arr?.[arr.length - 1] ?? 0);

  return (
    <main className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-sm text-white/60">Admin</div>
          <h1 className="text-2xl font-semibold">Poängtabell</h1>
          <div className="text-sm text-white/60">{season.name}</div>
        </div>
        <Link href={`/admin${seasonQuery}`} className="text-sm text-white/70 hover:underline">
          ← Admin
        </Link>
      </div>

      <form method="POST" action="/api/admin/points/save" className="space-y-6">
        <input type="hidden" name="season_id" value={season.id} />

        {/* Vanlig */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Vanlig</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => {
              const pl = i + 1;
              return (
                <div key={`V-${pl}`}>
                  <div className="text-xs text-white/60 mb-1">Plats {pl}</div>
                  <input
                    name={`points_VANLIG_${pl}`}
                    defaultValue={String(getPts("VANLIG", pl))}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* Major */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Major</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => {
              const pl = i + 1;
              return (
                <div key={`M-${pl}`}>
                  <div className="text-xs text-white/60 mb-1">Plats {pl}</div>
                  <input
                    name={`points_MAJOR_${pl}`}
                    defaultValue={String(getPts("MAJOR", pl))}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* Lagtävling */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Lagtävling (per spelare)</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => {
              const pl = i + 1;
              return (
                <div key={`L-${pl}`}>
                  <div className="text-xs text-white/60 mb-1">Plats {pl}</div>
                  <input
                    name={`points_LAGTÄVLING_${pl}`}
                    defaultValue={String(getPts("LAGTÄVLING", pl))}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* Final */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Final</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => {
              const pl = i + 1;
              return (
                <div key={`F-${pl}`}>
                  <div className="text-xs text-white/60 mb-1">Plats {pl}</div>
                  <input
                    name={`points_FINAL_${pl}`}
                    defaultValue={String(getPts("FINAL", pl))}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* Final startscore */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Final – startscore (slag)</h2>
          <p className="mt-1 text-sm text-white/60">Rank 1–8 får egna värden. Rank 9–12 använder “Default 9–12”.</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <div className="text-xs text-white/60 mb-1">Rank 1</div>
              <input name="final_r1" defaultValue={String(r1)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" />
            </div>
            <div>
              <div className="text-xs text-white/60 mb-1">Rank 2</div>
              <input name="final_r2" defaultValue={String(r2)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" />
            </div>
            <div>
              <div className="text-xs text-white/60 mb-1">Rank 3</div>
              <input name="final_r3" defaultValue={String(r3)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" />
            </div>
            <div>
              <div className="text-xs text-white/60 mb-1">Rank 4</div>
              <input name="final_r4" defaultValue={String(r4)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" />
            </div>
            <div>
              <div className="text-xs text-white/60 mb-1">Rank 5</div>
              <input name="final_r5" defaultValue={String(r5)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" />
            </div>
            <div>
              <div className="text-xs text-white/60 mb-1">Rank 6</div>
              <input name="final_r6" defaultValue={String(r6)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" />
            </div>
            <div>
              <div className="text-xs text-white/60 mb-1">Rank 7</div>
              <input name="final_r7" defaultValue={String(r7)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" />
            </div>
            <div>
              <div className="text-xs text-white/60 mb-1">Rank 8</div>
              <input name="final_r8" defaultValue={String(r8)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" />
            </div>
            <div>
              <div className="text-xs text-white/60 mb-1">Default 9–12</div>
              <input name="final_r9plus" defaultValue={String(r9)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" />
            </div>
          </div>
        </section>

        <button className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-semibold hover:bg-white/10">
          Spara poängtabell & final startscore
        </button>
      </form>
    </main>
  );
}