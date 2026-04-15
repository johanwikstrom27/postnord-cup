export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";
import {
  daysUntil,
  formatDateRange,
  normalizeCompetitionRow,
} from "@/lib/otherCompetitions/data";
import type { OtherCompetitionRow } from "@/lib/otherCompetitions/types";

type CardStatus = "upcoming" | "live" | "finished";

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cardStatus(competition: OtherCompetitionRow): { key: CardStatus; label: string } {
  if (competition.status === "locked") return { key: "finished", label: "Slutförd" };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = parseDate(competition.starts_on);
  const end = parseDate(competition.ends_on ?? competition.starts_on);

  if (start && today < start) return { key: "upcoming", label: "Kommande" };
  if (start && end && today >= start && today <= end) return { key: "live", label: "Pågår" };
  if (start && today >= start) return { key: "live", label: "Pågår" };

  return { key: "upcoming", label: "Kommande" };
}

function statusClass(status: CardStatus) {
  if (status === "live") return "border-sky-300/35 bg-sky-400/15 text-sky-100";
  if (status === "finished") return "border-emerald-300/35 bg-emerald-400/15 text-emerald-100";
  return "border-white/15 bg-black/35 text-white/85";
}

export default async function OtherCompetitionsPage() {
  const sb = supabaseServer();
  const resp = await sb
    .from("other_competitions")
    .select("*")
    .neq("status", "draft")
    .order("starts_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const competitions = ((resp.data ?? []) as Record<string, unknown>[]).map(normalizeCompetitionRow);

  return (
    <main className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_18px_70px_rgba(0,0,0,0.18)] md:p-6">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Andra tävlingar</h1>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {competitions.map((competition) => {
          const countdown = competition.status !== "locked" ? daysUntil(competition.starts_on) : null;
          const displayStatus = cardStatus(competition);
          const showCountdown = displayStatus.key === "upcoming" && countdown != null && countdown > 0;

          return (
            <Link
              key={competition.id}
              href={`/other-competitions/${competition.slug}`}
              className="group overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] shadow-[0_16px_60px_rgba(0,0,0,0.14)] transition hover:border-white/20 hover:bg-white/[0.07]"
            >
              <div className="relative h-[220px] overflow-hidden bg-black/25">
                {competition.card_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={competition.card_image_url}
                    alt={competition.name}
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 will-change-transform group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-white/45">
                    Bild saknas
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-black/20 to-black/10" />
                <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${statusClass(displayStatus.key)}`}>
                    {displayStatus.label}
                  </span>
                  {showCountdown ? (
                    <span className="rounded-full border border-amber-300/30 bg-amber-300/15 px-2.5 py-1 text-xs text-amber-100">
                      {countdown} dagar kvar
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="p-4">
                <h2 className="text-2xl font-semibold leading-tight text-white">{competition.name}</h2>
                <div className="mt-2 text-sm text-white/62">
                  {formatDateRange(competition.starts_on, competition.ends_on)}
                </div>
                {competition.location || competition.subtitle ? (
                  <div className="mt-2 line-clamp-2 text-sm leading-6 text-white/74">
                    {competition.location ?? competition.subtitle}
                  </div>
                ) : null}
              </div>
            </Link>
          );
        })}

        {competitions.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-white/15 bg-white/[0.03] p-8 text-center text-white/62 md:col-span-2 lg:col-span-3">
            Inga publicerade fristående tävlingar ännu.
          </div>
        ) : null}
      </section>
    </main>
  );
}
