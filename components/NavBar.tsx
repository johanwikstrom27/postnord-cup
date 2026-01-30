"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const LINKS = [
  { href: "/", label: "Hem" },
  { href: "/overview", label: "Överblick" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/events", label: "Tävlingar" },
  { href: "/players", label: "Spelare" },
  { href: "/stadgar", label: "Stadgar" },
  { href: "/history", label: "Historik" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

/** ===== Notifications UI (local only) ===== */
type NotifPrefs = {
  enabled: boolean;            // "Notiser på/av" (master)
  notify_results: boolean;     // 🥇 Resultat publicerat
  notify_leader: boolean;      // 🚨 Ny serieledare
};

const LS_KEY = "pn_push_prefs_v1";

function loadPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      return { enabled: false, notify_results: true, notify_leader: true };
    }
    const j = JSON.parse(raw);
    return {
      enabled: Boolean(j.enabled),
      notify_results: j.notify_results !== false,
      notify_leader: j.notify_leader !== false,
    };
  } catch {
    return { enabled: false, notify_results: true, notify_leader: true };
  }
}

function savePrefs(p: NotifPrefs) {
  localStorage.setItem(LS_KEY, JSON.stringify(p));
}

export default function NavBar() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);

  // bell dropdown
  const [bellOpen, setBellOpen] = useState(false);
  const bellBtnRef = useRef<HTMLButtonElement | null>(null);
  const bellDropRef = useRef<HTMLDivElement | null>(null);

  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const activeLabel = useMemo(() => {
    const found = LINKS.find((l) => isActivePath(pathname, l.href));
    return found?.label ?? "Meny";
  }, [pathname]);

  // Prefs (local-only for phase 1)
  const [prefs, setPrefs] = useState<NotifPrefs>({
    enabled: false,
    notify_results: true,
    notify_leader: true,
  });
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    // load once
    if (typeof window === "undefined") return;
    const p = loadPrefs();
    setPrefs(p);
    setPrefsLoaded(true);
  }, []);

  const bellDotOn = prefs.enabled && (prefs.notify_results || prefs.notify_leader);

  // Close on route change
  useEffect(() => {
    setOpen(false);
    setBellOpen(false);
  }, [pathname]);

  // Close on ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setBellOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close on click outside (menu + bell)
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node;

      if (open) {
        if (dropdownRef.current?.contains(t)) return;
        if (menuBtnRef.current?.contains(t)) return;
        setOpen(false);
      }

      if (bellOpen) {
        if (bellDropRef.current?.contains(t)) return;
        if (bellBtnRef.current?.contains(t)) return;
        setBellOpen(false);
      }
    }
    window.addEventListener("mousedown", onDown, true);
    return () => window.removeEventListener("mousedown", onDown, true);
  }, [open, bellOpen]);

  function toggleMenu() {
    setOpen((v) => !v);
    setBellOpen(false); // never show both
  }

  function toggleBell() {
    setBellOpen((v) => !v);
    setOpen(false); // never show both
  }

  function persist(p: NotifPrefs) {
    setPrefs(p);
    if (prefsLoaded) savePrefs(p);
  }

  return (
    <header className="sticky top-4 z-50 px-4">
      <div className="mx-auto max-w-7xl rounded-2xl border border-white/10 bg-gradient-to-r from-[#0b1020]/80 to-[#0b1626]/80 backdrop-blur-xl shadow-lg">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/pncuplogga-v4.png"
                alt="PostNord Cup"
                className="max-h-8 max-w-8 object-contain"
              />
            </div>

            <div className="min-w-0 leading-tight">
              <div className="font-semibold text-white truncate">PostNord Cup</div>
              <div className="text-xs text-white/60 truncate">Trackman @ Troxhammar GK</div>
            </div>
          </Link>

          {/* Right side */}
          <div className="relative flex items-center gap-2">
            {/* 🔔 Notifications button */}
            <button
              ref={bellBtnRef}
              type="button"
              onClick={toggleBell}
              className={[
                "relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition",
                bellOpen ? "ring-1 ring-blue-400/40" : "",
              ].join(" ")}
              title="Notiser"
              aria-label="Notiser"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/bell-icon.png" alt="Notiser" className="h-5 w-5 object-contain" />
              {bellDotOn ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-400" /> : null}
            </button>

            {/* 🔔 Dropdown */}
            {bellOpen && (
              <>
                <div className="fixed inset-0 z-[55] bg-transparent" />
                <div
                  ref={bellDropRef}
                  className="fixed z-[60] right-4 top-[86px] w-[340px] overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220] shadow-2xl"
                >
                  <div className="p-4 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold">Notiser</div>
                        <div className="text-sm text-white/60">
                          {prefs.enabled ? "Aktiva" : "Avstängda"}
                        </div>
                      </div>

                      {!prefs.enabled ? (
                        <button
                          onClick={() => persist({ ...prefs, enabled: true })}
                          className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
                        >
                          Aktivera
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            persist({
                              enabled: false,
                              notify_results: prefs.notify_results,
                              notify_leader: prefs.notify_leader,
                            })
                          }
                          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10"
                        >
                          Stäng av
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      <label className="flex items-center justify-between gap-3">
                        <span className="text-base">🥇 Resultat publicerat</span>
                        <input
                          type="checkbox"
                          checked={prefs.notify_results}
                          onChange={(e) => persist({ ...prefs, notify_results: e.target.checked })}
                        />
                      </label>

                      <label className="flex items-center justify-between gap-3">
                        <span className="text-base">🚨 Ny serieledare</span>
                        <input
                          type="checkbox"
                          checked={prefs.notify_leader}
                          onChange={(e) => persist({ ...prefs, notify_leader: e.target.checked })}
                        />
                      </label>
                    </div>

                    <button
                      onClick={() => {
                        savePrefs(prefs);
                        setBellOpen(false);
                      }}
                      className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/15"
                    >
                      Spara inställningar
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ☰ Menu button */}
            <div className="relative flex items-center">
              <button
                ref={menuBtnRef}
                type="button"
                onClick={toggleMenu}
                className={[
                  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-medium text-white/90 hover:bg-white/10 transition",
                  "max-w-[120px]",
                  open ? "ring-1 ring-blue-400/40" : "",
                ].join(" ")}
                aria-expanded={open}
                aria-label="Öppna meny"
              >
                <span className="hidden sm:inline truncate">{activeLabel}</span>
                <span className="text-base leading-none">{open ? "✕" : "☰"}</span>
              </button>

              {/* Dropdown overlay */}
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
                            href={l.href}
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