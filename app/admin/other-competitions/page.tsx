export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";
import { formatDateRange, normalizeCompetitionRow, statusLabel } from "@/lib/otherCompetitions/data";

function statusClass(status: string) {
  if (status === "draft") return "border-white/10 bg-white/5 text-white/66";
  if (status === "live") return "border-sky-300/35 bg-sky-400/15 text-sky-100";
  if (status === "locked") return "border-emerald-300/35 bg-emerald-400/15 text-emerald-100";
  return "border-white/15 bg-white/10 text-white/86";
}

export default async function AdminOtherCompetitionsPage() {
  const sb = supabaseServer();
  const resp = await sb
    .from("other_competitions")
    .select("*")
    .order("starts_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const competitions = ((resp.data ?? []) as Record<string, unknown>[]).map(normalizeCompetitionRow);

  return (
    <main className="space-y-6">
      <section className="rounded-[30px] border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.16)] md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-white/45">Admin</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Andra tävlingar</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/66">
              Skapa, publicera, duplicera och lås fristående golfresor och specialtävlingar utan att röra PostNord Cup.
            </p>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium transition hover:bg-white/10"
          >
            Till admin
          </Link>
        </div>
      </section>

      <section className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4 md:p-5">
        <h2 className="text-xl font-semibold">Skapa ny tävling</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]" method="POST" action="/api/admin/other-competitions/create">
          <input
            name="name"
            placeholder="Tävlingsnamn, t.ex. Gotland 2026"
            className="min-h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none focus:border-white/25"
            required
          />
          <input
            name="starts_on"
            type="date"
            className="min-h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none focus:border-white/25"
          />
          <button className="min-h-12 rounded-2xl border border-white/10 bg-white/8 px-4 text-sm font-semibold transition hover:bg-white/12">
            Skapa utkast
          </button>
        </form>
      </section>

      <section className="grid gap-3">
        {competitions.map((competition) => (
          <div key={competition.id} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 md:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-semibold leading-tight">{competition.name}</h2>
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${statusClass(competition.status)}`}>
                    {statusLabel(competition.status)}
                  </span>
                </div>
                <div className="mt-2 text-sm text-white/58">
                  {formatDateRange(competition.starts_on, competition.ends_on)}
                  {competition.location ? ` · ${competition.location}` : ""}
                </div>
                <div className="mt-1 text-xs text-white/42">/{competition.slug}</div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {competition.status !== "draft" ? (
                  <Link
                    href={`/other-competitions/${competition.slug}`}
                    className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium transition hover:bg-white/10"
                  >
                    Visa
                  </Link>
                ) : (
                  <span className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/38">
                    Ej publik
                  </span>
                )}
                <Link
                  href={`/admin/other-competitions/${competition.id}`}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium transition hover:bg-white/10"
                >
                  Redigera
                </Link>
                <form method="POST" action={`/api/admin/other-competitions/${competition.id}/duplicate`}>
                  <button className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium transition hover:bg-white/10">
                    Duplicera
                  </button>
                </form>
              </div>
            </div>
          </div>
        ))}

        {competitions.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-white/10 px-4 py-8 text-center text-white/60">
            Inga fristående tävlingar ännu.
          </div>
        ) : null}
      </section>
    </main>
  );
}
