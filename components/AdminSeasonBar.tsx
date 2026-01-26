"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Season = { id: string; name: string };

function buildHref(path: string, seasonId: string | null) {
  if (!seasonId) return path;
  return `${path}?season=${encodeURIComponent(seasonId)}`;
}

export default function AdminSeasonBar({
  seasons,
  currentSeasonId,
}: {
  seasons: Season[];
  currentSeasonId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const selected = sp.get("season") ?? currentSeasonId ?? "";

  // ✅ Om man kommer in utan ?season, sätt den automatiskt till aktiv säsong
  useEffect(() => {
    if (!sp.get("season") && currentSeasonId) {
      const params = new URLSearchParams(sp.toString());
      params.set("season", currentSeasonId);
      router.replace(`${pathname}?${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSeasonId]);

  function onChangeSeason(nextId: string) {
    const params = new URLSearchParams(sp.toString());
    if (nextId) params.set("season", nextId);
    else params.delete("season");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200">
            ADMIN
          </span>
          <div className="text-sm text-white/70">Aktiv säsong</div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selected}
            onChange={(e) => onChangeSeason(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <Link
            href="/admin/seasons"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
          >
            Säsonger →
          </Link>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={buildHref("/admin", selected)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
        >
          Resultat
        </Link>
        <Link
          href={buildHref("/admin/players", selected)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
        >
          Säsongsspelare
        </Link>
        <Link
          href={buildHref("/admin/events", selected)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
        >
          Tävlingar
        </Link>
        <Link
          href="/admin/people"
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
        >
          Spelarprofiler
        </Link>
        <Link
          href={buildHref("/admin/rules", selected)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
        >
          Regler
        </Link>
        <Link
          href={buildHref("/admin/points", selected)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
        >
          Poängtabell
        </Link>
      </div>
    </div>
  );
}