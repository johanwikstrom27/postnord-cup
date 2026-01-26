export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 shadow-sm">
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="p-5 border-b border-white/10">{children}</div>;
}

export function CardContent({ children }: { children: React.ReactNode }) {
  return <div className="p-5">{children}</div>;
}

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-white/80">
      {children}
    </span>
  );
}

export function Button({
  children,
  href,
}: {
  children: React.ReactNode;
  href?: string;
}) {
  const cls =
    "inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10";
  if (href) return <a href={href} className={cls}>{children}</a>;
  return <button className={cls}>{children}</button>;
}