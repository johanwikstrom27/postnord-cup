export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { supabaseServer } from "@/lib/supabase";

type SeasonRow = { id: string; name: string; created_at: string; is_current?: boolean };

type RulesRow = {
  vanlig_best_of: number | null;
  major_best_of: number | null;
  lagtavling_best_of: number | null;

  // kan finnas i din DB
  hcp0_max?: number | null;
  hcp2_max?: number | null;
};

type SPRow = {
  id: string;
  person_id: string;
  hcp: number;
  people: { name: string; avatar_url: string | null } | null;
};

type PointsRow = {
  event_type: string;
  placing: number;
  points: number;
};

function fmtInt(n: number) {
  return n.toLocaleString("sv-SE");
}

async function resolveSeason(sb: ReturnType<typeof supabaseServer>) {
  const cur = await sb
    .from("seasons")
    .select("id,name,created_at,is_current")
    .eq("is_current", true)
    .limit(1)
    .single();
  if (cur.data) return cur.data as SeasonRow;

  const latest = await sb
    .from("seasons")
    .select("id,name,created_at,is_current")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return (latest.data as SeasonRow) ?? null;
}

function pnHcpSlag(hcp: number, hcp0Max: number, hcp2Max: number) {
  if (hcp <= hcp0Max) return 0;
  if (hcp <= hcp2Max) return 2;
  return 4;
}

const FINAL_START_BY_RANK: { rank: number; start: number }[] = [
  { rank: 1, start: -10 },
  { rank: 2, start: -8 },
  { rank: 3, start: -6 },
  { rank: 4, start: -5 },
  { rank: 5, start: -4 },
  { rank: 6, start: -3 },
  { rank: 7, start: -2 },
  { rank: 8, start: -1 },
];

function pointsFallback(eventType: string): { placing: number; points: number }[] {
  if (eventType === "VANLIG") {
    return [
      { placing: 1, points: 2000 },
      { placing: 2, points: 1200 },
      { placing: 3, points: 760 },
      { placing: 4, points: 540 },
      { placing: 5, points: 440 },
      { placing: 6, points: 400 },
      { placing: 7, points: 360 },
      { placing: 8, points: 340 },
      { placing: 9, points: 320 },
      { placing: 10, points: 300 },
      { placing: 11, points: 280 },
      { placing: 12, points: 260 },
    ];
  }
  if (eventType === "MAJOR") {
    return [
      { placing: 1, points: 4000 },
      { placing: 2, points: 2400 },
      { placing: 3, points: 1520 },
      { placing: 4, points: 1080 },
      { placing: 5, points: 880 },
      { placing: 6, points: 800 },
      { placing: 7, points: 720 },
      { placing: 8, points: 680 },
      { placing: 9, points: 640 },
      { placing: 10, points: 600 },
      { placing: 11, points: 560 },
      { placing: 12, points: 520 },
    ];
  }
  // Lagtävling (2v2) – topp 6
  return [
    { placing: 1, points: 2000 },
    { placing: 2, points: 1200 },
    { placing: 3, points: 760 },
    { placing: 4, points: 540 },
    { placing: 5, points: 440 },
    { placing: 6, points: 400 },
  ];
}

export default async function StadgarPage() {
  const sb = supabaseServer();
  const season = await resolveSeason(sb);
  if (!season) return <div className="text-white/70">Ingen säsong hittades.</div>;

  // Regler (best-of + HCP-gränser)
  const rulesResp = await sb
    .from("season_rules")
    .select("vanlig_best_of,major_best_of,lagtavling_best_of,hcp0_max,hcp2_max")
    .eq("season_id", season.id)
    .single();

  const rules = (rulesResp.data as RulesRow | null) ?? null;

  const vanligBest = Number(rules?.vanlig_best_of ?? 4);
  const majorBest = Number(rules?.major_best_of ?? 3);
  const lagBest = Number(rules?.lagtavling_best_of ?? 2);

  const hcp0Max = Number(rules?.hcp0_max ?? 10.5);
  const hcp2Max = Number(rules?.hcp2_max ?? 15.5);

  // Spelare
  const spResp = await sb
    .from("season_players")
    .select("id,person_id,hcp,people(name,avatar_url)")
    .eq("season_id", season.id)
    .order("hcp", { ascending: true });

  const players = ((spResp.data ?? []) as any[]).map((p) => ({
    id: String(p.id),
    person_id: String(p.person_id),
    hcp: Number(p.hcp ?? 0),
    people: p.people ?? null,
  })) as SPRow[];

  // Poängtabell (DB eller fallback)
  const ptResp = await sb
    .from("points_table")
    .select("event_type,placing,points")
    .eq("season_id", season.id)
    .order("event_type", { ascending: true })
    .order("placing", { ascending: true });

  const pointsRows = (ptResp.data as PointsRow[] | null) ?? [];

  const pointsFor = (eventType: "VANLIG" | "MAJOR" | "LAGTÄVLING") => {
    const fromDb = pointsRows
      .filter((r) => r.event_type === eventType)
      .map((r) => ({ placing: Number(r.placing), points: Number(r.points) }))
      .sort((a, b) => a.placing - b.placing);

    return fromDb.length ? fromDb : pointsFallback(eventType);
  };

  const regularPoints = pointsFor("VANLIG");
  const majorPoints = pointsFor("MAJOR");
  const teamPoints = pointsFor("LAGTÄVLING");

  return (
    <main className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="text-sm text-white/60">Stadgar</div>
        <h1 className="mt-1 text-3xl sm:text-4xl font-semibold tracking-tight">{season.name}</h1>
        <div className="mt-2 text-white/60">
          Sammanställning av regler, HCP/PN-HCP, finalens startscore och poängfördelning.
        </div>
      </section>

      {/* Stadgar */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold">Stadgar</h2>
        <ul className="mt-3 space-y-2 text-white/80 list-disc pl-5">
          <li>Alla är inbjudna till varje tävling.</li>
          <li>Vid utebliven närvaro delas inga poäng ut för spelaren.</li>
          <li>Av de vanliga tävlingarna räknas endast de bästa {vanligBest} av 6 möjliga.</li>
          <li>Av major-tävlingarna räknas endast de bästa {majorBest} av 4 möjliga.</li>
          <li>
            Av lagtävlingarna (2v2) räknas de bästa {lagBest} av 2 möjliga. Lagen <b>slumpas</b> till dessa tävlingar.
          </li>
          <li>Vid delad förstaplats i någon tävling blir det särspel (puttävling, bäst av 3).</li>
          <li>Vid oavgjort på andra placeringar får båda spelarna den högre poängen.</li>
          <li>Maximalt 14 klubbor i bagen.</li>
        </ul>

        <h3 className="mt-6 text-lg font-semibold">Trackmanregler</h3>
        <ul className="mt-3 space-y-2 text-white/80 list-disc pl-5">
          <li>Samtliga tävlingar spelas med puttning: Auto – Fixed.</li>
          <li>Inga mulligans.</li>
          <li>Slår man en socket som ej registreras måste man visa tacksamhet.</li>
          <li>Samtliga spelare väljer tees, pins &amp; vind enligt fliken för aktuella tävlingen.</li>
        </ul>
      </section>

      {/* Spelare & PN-HCP */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold">Spelare &amp; PN-HCP</h2>
        <div className="mt-2 text-white/60 text-sm">
          PN-HCP = antal slag per tävling enligt säsongens HCP-gränser:
          <span className="ml-2 whitespace-nowrap">0–{hcp0Max.toFixed(1)} ⇒ 0 slag</span>,{" "}
          <span className="whitespace-nowrap">{(hcp0Max + 0.1).toFixed(1)}–{hcp2Max.toFixed(1)} ⇒ 2 slag</span>,{" "}
          <span className="whitespace-nowrap">{(hcp2Max + 0.1).toFixed(1)}+ ⇒ 4 slag</span>.
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-white/60">
              <tr className="border-b border-white/10">
                <th className="px-3 py-2 text-left">Spelare</th>
                <th className="px-3 py-2 text-right">HCP</th>
                <th className="px-3 py-2 text-right">PN-HCP (slag)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {players.map((p) => {
                const name = p.people?.name ?? "Okänd";
                const slag = pnHcpSlag(p.hcp, hcp0Max, hcp2Max);
                return (
                  <tr key={p.person_id}>
                    <td className="px-3 py-2">{name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.hcp.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{slag}</td>
                  </tr>
                );
              })}
              {!players.length && (
                <tr>
                  <td className="px-3 py-4 text-white/60" colSpan={3}>
                    Inga spelare hittades för säsongen.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Final startscore */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold">Startscore inför Final</h2>
        <div className="mt-2 text-white/60 text-sm">
          <div>Startscore = Serieplacering inkl. PN-HCP (0/2/4 slag).</div>
          <div>T.ex. 1:an startar på -10 och om PN-HCP är 2 slag = Startscore -12.</div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-white/60">
              <tr className="border-b border-white/10">
                <th className="px-3 py-2 text-left">Serieplacering</th>
                <th className="px-3 py-2 text-right">Startscore (slag)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {FINAL_START_BY_RANK.map((r) => (
                <tr key={r.rank}>
                  <td className="px-3 py-2">#{r.rank}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.start}</td>
                </tr>
              ))}
              <tr>
                <td className="px-3 py-2">#9–#12</td>
                <td className="px-3 py-2 text-right tabular-nums">0</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Poängfördelning */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold">Poängfördelning</h2>
        <div className="mt-2 text-white/60 text-sm">
          I varje tävling koras en vinnare, direkt eller via särspel. T.ex. tre spelare delar bästa nettoscore,
          särspel avgör plats nr 1 och övriga två spelare tilldelas poängen för plats nr 2. Fjärde bästa spelaren
          tilldelas plats nr 4 och poäng därefter.
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {/* Vanlig */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="font-semibold">PostNord Cup-tävlingar (Vanlig)</div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-white/60">
                  <tr className="border-b border-white/10">
                    <th className="py-2 text-left">Placering</th>
                    <th className="py-2 text-right">Poäng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {regularPoints.map((r) => (
                    <tr key={r.placing}>
                      <td className="py-2">#{r.placing}</td>
                      <td className="py-2 text-right tabular-nums">{fmtInt(r.points)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Major */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="font-semibold">Major-tävlingar</div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-white/60">
                  <tr className="border-b border-white/10">
                    <th className="py-2 text-left">Placering</th>
                    <th className="py-2 text-right">Poäng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {majorPoints.map((r) => (
                    <tr key={r.placing}>
                      <td className="py-2">#{r.placing}</td>
                      <td className="py-2 text-right tabular-nums">{fmtInt(r.points)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Lagtävling */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="font-semibold">Lagtävling (2v2)</div>
            <div className="mt-1 text-xs text-white/60">Poäng per spelare i laget.</div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-white/60">
                  <tr className="border-b border-white/10">
                    <th className="py-2 text-left">Placering</th>
                    <th className="py-2 text-right">Poäng / spelare</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {teamPoints.map((r) => (
                    <tr key={r.placing}>
                      <td className="py-2">#{r.placing}</td>
                      <td className="py-2 text-right tabular-nums">{fmtInt(r.points)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}