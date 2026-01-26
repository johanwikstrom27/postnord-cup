export const runtime = "nodejs";

import Link from "next/link";

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const next = searchParams?.next ?? "/admin";

  return (
    <main className="mx-auto max-w-md space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm text-white/60">Admin</div>
        <h1 className="text-2xl font-semibold">Logga in</h1>
        <p className="mt-2 text-sm text-white/70">
          Ange lösenord för att komma åt admin.
        </p>

        <form
          className="mt-5 space-y-3"
          method="POST"
          action={`/api/admin/login?next=${encodeURIComponent(next)}`}
        >
          <input
            name="password"
            type="password"
            placeholder="Lösenord"
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
            required
          />

          <button className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-semibold hover:bg-white/10">
            Logga in
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link href="/" className="text-sm text-white/60 hover:underline">
            ← Till startsidan
          </Link>
        </div>
      </div>
    </main>
  );
}