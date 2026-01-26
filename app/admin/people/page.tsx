export const runtime = "nodejs";

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";

type PersonRow = {
  id: string;
  name: string;
  avatar_url: string | null;
};

export default async function AdminPeoplePage() {
  const sb = supabaseServer();

  const peopleResp = await sb
    .from("people")
    .select("id,name,avatar_url")
    .order("name", { ascending: true });

  const people = (peopleResp.data as PersonRow[] | null) ?? [];

  return (
    <main className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-sm text-white/60">Admin</div>
          <h1 className="text-2xl font-semibold">Spelarprofiler</h1>
          <div className="text-sm text-white/60">Redigera avatar, bio, kuriosa, styrkor & svagheter.</div>
        </div>
        <Link href="/admin" className="text-sm text-white/70 hover:underline">
          ← Admin
        </Link>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="font-semibold">Skapa ny spelare (profil)</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-3" method="POST" action="/api/admin/people/create">
          <input
            name="name"
            placeholder="Namn"
            className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
            required
          />
          <input
            name="avatar_url"
            placeholder="Avatar URL (valfritt)"
            className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
          />
          <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-semibold hover:bg-white/10">
            Skapa
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        {people.map((p) => (
          <Link
            key={p.id}
            href={`/admin/people/${p.id}`}
            className="flex items-center justify-between border-b border-white/10 px-4 py-4 hover:bg-white/5 last:border-b-0"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-white/5">
                {p.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatar_url} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm">⛳</div>
                )}
              </div>
              <div className="font-semibold">{p.name}</div>
            </div>

            <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
              Redigera →
            </span>
          </Link>
        ))}

        {people.length === 0 && (
          <div className="px-4 py-6 text-white/60">Inga spelare ännu.</div>
        )}
      </section>
    </main>
  );
}