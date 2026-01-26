"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Hem" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/events", label: "Tävlingar" },
  { href: "/players", label: "Spelare" },
  { href: "/history", label: "Historik" },
];

export default function NavBar() {
  const pathname = usePathname() || "/";

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-4 z-50 px-4">
      <div className="mx-auto max-w-7xl rounded-2xl border border-white/10 bg-gradient-to-r from-[#0b1020]/80 to-[#0b1626]/80 backdrop-blur-xl shadow-lg">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          {/* LEFT: Desktop-only brand (hidden on mobile) */}
          <Link href="/" className="hidden md:flex items-center gap-3 shrink-0">
            <div className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/pncuplogga-v2.png"
                alt="PostNord Cup"
                className="max-h-8 max-w-8 object-contain"
              />
            </div>
            <div className="leading-tight">
              <div className="font-semibold text-white">PostNord Cup</div>
              <div className="text-xs text-white/60">Trackman @ Troxhammar GK</div>
            </div>
          </Link>

          {/* CENTER: Tabs */}
          <nav className="flex-1">
            <div className="mx-auto flex max-w-xl items-center justify-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={[
                    "relative rounded-xl px-3 py-2 text-sm font-medium transition",
                    isActive(l.href)
                      ? "bg-gradient-to-br from-blue-500/25 to-cyan-400/15 text-white ring-1 ring-blue-400/40 shadow-[0_0_12px_rgba(80,140,255,0.25)]"
                      : "text-white/70 hover:text-white hover:bg-white/5",
                  ].join(" ")}
                >
                  {l.label}
                  {isActive(l.href) && (
                    <span className="absolute left-2 right-2 -bottom-1 h-[2px] rounded-full bg-gradient-to-r from-blue-400 to-cyan-300" />
                  )}
                </Link>
              ))}
            </div>
          </nav>

          {/* RIGHT: Admin */}
          <Link
            href="/admin"
            title="Admin"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition"
          >
            ⚙️
          </Link>
        </div>
      </div>
    </header>
  );
}