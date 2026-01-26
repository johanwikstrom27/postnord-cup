"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Hem" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/events", label: "Tävlingar" },
  { href: "/players", label: "Spelare" },
  { href: "/history", label: "Historik" },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function NavBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-4 z-50 px-4">
      <div className="mx-auto max-w-7xl rounded-2xl border border-white/10 bg-gradient-to-r from-[#0b1020]/80 to-[#0b1626]/80 backdrop-blur-xl shadow-lg">
        <div className="flex items-center justify-between px-4 py-3 gap-4">
          {/* LEFT */}
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/pncuplogga.png"
                alt="PostNord Cup"
                className="max-h-7 max-w-7 object-contain"
              />
            </div>

            <div className="leading-tight hidden sm:block">
              <div className="font-semibold text-white">PostNord Cup</div>
              <div className="text-xs text-white/60">Trackman @ Troxhammar GK</div>
            </div>
          </Link>

          {/* RIGHT */}
          <nav className="flex items-center gap-2 text-sm flex-wrap justify-end">
            {NAV.map((i) => {
              const active = isActive(pathname, i.href);
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  className={cx(
                    "relative rounded-xl px-3 py-2 transition font-medium",
                    active
                      ? // 🔥 AKTIV
                        "bg-gradient-to-br from-blue-500/25 to-cyan-400/15 text-white ring-1 ring-blue-400/40 shadow-[0_0_12px_rgba(80,140,255,0.35)]"
                      : // 😌 INAKTIV
                        "text-white/70 hover:text-white hover:bg-white/5"
                  )}
                >
                  {i.label}

                  {/* underline-indikator */}
                  {active && (
                    <span className="absolute left-2 right-2 -bottom-1 h-[2px] rounded-full bg-gradient-to-r from-blue-400 to-cyan-300" />
                  )}
                </Link>
              );
            })}

            <Link
              href="/admin"
              className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition"
              title="Admin"
            >
              ⚙️
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}