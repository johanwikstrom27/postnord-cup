"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import NotificationBell from "@/components/NotificationBell";

const LINKS = [
  { href: "/", label: "Hem" },
  { href: "/overview", label: "Överblick" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/events", label: "Tävlingar" },
  { href: "/players", label: "Spelare" },
  { href: "/wheel", label: "SpinThePostbil" },
  { href: "/stadgar", label: "Stadgar" },
  { href: "/history", label: "Historik" },
];

const SEASON_AWARE_LINKS = new Set(["/", "/overview", "/leaderboard", "/events", "/players", "/stadgar"]);

type SeasonOption = {
  id: string;
  name: string;
  is_current: boolean | null;
  created_at: string;
};

function seasonYear(name: string) {
  const match = name.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : 0;
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [seasonOverrideId, setSeasonOverrideId] = useState("");

  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const activeLabel = useMemo(() => {
    const found = LINKS.find((l) => isActivePath(pathname, l.href));
    return found?.label ?? "Meny";
  }, [pathname]);

  const requestedSeasonId = searchParams?.get("season") ?? null;
  const activeSeasonId = seasons.find((season) => season.is_current)?.id ?? seasons[0]?.id ?? "";
  const validRequestedSeasonId =
    requestedSeasonId && seasons.some((season) => season.id === requestedSeasonId) ? requestedSeasonId : null;
  const validOverrideSeasonId =
    seasonOverrideId && seasons.some((season) => season.id === seasonOverrideId) ? seasonOverrideId : "";

  useEffect(() => {
    let cancelled = false;

    async function loadSeasons() {
      try {
        const res = await fetch("/api/seasons", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { seasons?: SeasonOption[] };
        if (!cancelled) setSeasons(data.seasons ?? []);
      } catch {
        // ignore menu-only enhancement failures
      }
    }

    loadSeasons();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedSeasonId = validRequestedSeasonId
    ?? (SEASON_AWARE_LINKS.has(pathname) ? activeSeasonId : validOverrideSeasonId || activeSeasonId);

  const selectedSeasonName = useMemo(() => {
    if (!selectedSeasonId) return "Aktiv säsong";
    return seasons.find((season) => season.id === selectedSeasonId)?.name ?? "Aktiv säsong";
  }, [selectedSeasonId, seasons]);

  const selectedSeasonShort = useMemo(() => {
    const match = selectedSeasonName.match(/\d{4}\/\d{4}/);
    return match?.[0] ?? "";
  }, [selectedSeasonName]);

  const seasonsSorted = useMemo(
    () => [...seasons].sort((a, b) => seasonYear(b.name) - seasonYear(a.name)),
    [seasons]
  );

  function hrefFor(linkHref: string) {
    if (!SEASON_AWARE_LINKS.has(linkHref)) return linkHref;
    if (!selectedSeasonId) return linkHref;
    return `${linkHref}?season=${encodeURIComponent(selectedSeasonId)}`;
  }

  function handleSeasonChange(nextSeasonId: string) {
    setSeasonOverrideId(nextSeasonId);

    if (!SEASON_AWARE_LINKS.has(pathname)) return;

    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (nextSeasonId) params.set("season", nextSeasonId);
    else params.delete("season");

    const nextHref = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.push(nextHref);
  }

  // Close on ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close on click outside (menu only)
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node;
      if (dropdownRef.current?.contains(t)) return;
      if (menuBtnRef.current?.contains(t)) return;
      setOpen(false);
    }
    window.addEventListener("mousedown", onDown, true);
    return () => window.removeEventListener("mousedown", onDown, true);
  }, [open]);

  return (
    <header className="sticky top-4 z-50 px-4">
      <div className="mx-auto max-w-7xl rounded-2xl border border-white/10 bg-gradient-to-r from-[#0b1020]/80 to-[#0b1626]/80 backdrop-blur-xl shadow-lg">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          {/* Brand */}
          <Link href={hrefFor("/")} className="flex min-w-0 flex-1 items-center gap-3 pr-2">
            <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-visible sm:h-20 sm:w-20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/pncuplogga-v4.png"
                alt="PostNord Cup"
                className="h-full w-full object-contain"
              />
            </div>

            <div className="min-w-0 leading-tight">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <div className="text-[17px] font-semibold text-white sm:text-[18px]">PostNord Cup</div>
                {selectedSeasonShort ? (
                  <div className="text-[11px] font-medium text-white/55 sm:text-[12px]">{selectedSeasonShort}</div>
                ) : null}
              </div>
              <div className="text-[11px] text-white/60 sm:text-xs">Trackman @ Troxhammar GK</div>
            </div>
          </Link>

          {/* Right side */}
          <div className="relative flex items-center gap-2">
            {/* 🔔 Notifications (real push) */}
            <NotificationBell />

            {/* ☰ Menu button */}
            <div className="relative flex items-center">
              <button
                ref={menuBtnRef}
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={[
                  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-medium text-white/90 hover:bg-white/10 transition",
                  "max-w-[120px] sm:max-w-none sm:min-w-[220px]",
                  open ? "ring-1 ring-blue-400/40" : "",
                ].join(" ")}
                aria-expanded={open}
                aria-label="Öppna meny"
              >
                <span className="hidden sm:inline whitespace-nowrap">{activeLabel}</span>
                <span className="inline-flex h-5 w-5 items-center justify-center" aria-hidden>
                  {open ? (
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 6h12M4 10h12M4 14h12" strokeLinecap="round" />
                    </svg>
                  )}
                </span>
              </button>

              {open && (
                <>
                  <div className="fixed inset-0 z-[55] bg-transparent" />

                  <div
                    ref={dropdownRef}
                    className="fixed z-[60] right-4 top-[86px] w-[260px] overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220] shadow-2xl"
                  >
                    <div className="max-h-[70vh] overflow-auto p-2">
                      {LINKS.map((l) => {
                        const active = isActivePath(pathname, l.href);
                        return (
                          <Link
                            key={l.href}
                            href={hrefFor(l.href)}
                            onClick={() => setOpen(false)}
                            className={[
                              "flex items-center justify-between rounded-xl px-3 py-3 text-sm transition",
                              active
                                ? "bg-white/10 text-white ring-1 ring-blue-400/25"
                                : "text-white/85 hover:bg-white/5 hover:text-white",
                            ].join(" ")}
                          >
                            <span>{l.label}</span>
                            {active ? <span className="text-[10px] text-white/60">Aktiv</span> : null}
                          </Link>
                        );
                      })}

                      {seasons.length > 1 ? (
                        <>
                          <div className="my-2 border-t border-white/10" />

                          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                            <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">Säsong</div>
                            <div className="mt-2">
                              <select
                                value={selectedSeasonId}
                                onChange={(e) => handleSeasonChange(e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-[#0f1726] px-3 py-2 text-sm text-white outline-none"
                              >
                                {seasonsSorted.map((season) => (
                                  <option key={season.id} value={season.id}>
                                    {season.name}
                                    {season.is_current ? " (Aktiv)" : ""}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </>
                      ) : null}

                      <div className="my-2 border-t border-white/10" />

                      <Link
                        href="/admin"
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-between rounded-xl px-3 py-3 text-sm text-white/85 hover:bg-white/5 hover:text-white transition"
                      >
                        <span className="flex items-center gap-2">
                          <span>⚙️</span>
                          <span>Admin</span>
                        </span>
                        <span className="text-[10px] text-white/50">Skyddad</span>
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
