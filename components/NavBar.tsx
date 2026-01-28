"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const LINKS = [
  { href: "/", label: "Hem" },
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

export default function NavBar() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);

  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const activeLabel = useMemo(() => {
    const found = LINKS.find((l) => isActivePath(pathname, l.href));
    return found?.label ?? "Meny";
  }, [pathname]);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close on click outside
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

          {/* Right: compact menu button (never sticks out) */}
          <div className="relative flex items-center">
            <button
              ref={menuBtnRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              className={[
                "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-medium text-white/90 hover:bg-white/10 transition",
                "max-w-[120px]",
                open ? "ring-1 ring-blue-400/40" : "",
              ].join(" ")}
              aria-expanded={open}
              aria-label="Öppna meny"
            >
              {/* Label hidden on very small widths */}
              <span className="hidden sm:inline truncate">{activeLabel}</span>
              <span className="text-base leading-none">{open ? "✕" : "☰"}</span>
            </button>

            {/* Dropdown overlay (right aligned under button) */}
            {open && (
              <>
                {/* click-catcher */}
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

                    {/* Admin in dropdown (more space in navbar) */}
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
    </header>
  );
}