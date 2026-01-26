export const runtime = "nodejs";

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";

type PersonRow = {
  id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  fun_facts: string | null;
  strengths: string | null;
  weaknesses: string | null;
};

export default async function AdminPersonEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = supabaseServer();

  const personResp = await sb
    .from("people")
    .select("id,name,avatar_url,bio,fun_facts,strengths,weaknesses")
    .eq("id", id)
    .single();

  const person = (personResp.data as PersonRow | null) ?? null;
  if (!person) return <div className="text-white/70">Spelaren hittades inte.</div>;

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/admin/people" className="text-sm text-white/70 hover:underline">
          ← Spelarprofiler
        </Link>
        <Link href={`/players/${person.id}`} className="text-sm text-white/70 hover:underline">
          Öppna publika profilen →
        </Link>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 overflow-hidden rounded-full border border-white/10 bg-white/5">
            {person.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={person.avatar_url} alt={person.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl">⛳</div>
            )}
          </div>
          <div>
            <div className="text-sm text-white/60">Redigera profil</div>
            <h1 className="text-2xl font-semibold">{person.name}</h1>
          </div>
        </div>

        <form className="mt-6 space-y-5" method="POST" action="/api/admin/people/update">
          <input type="hidden" name="id" value={person.id} />

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs text-white/60 mb-1">Namn</div>
              <input
                name="name"
                defaultValue={person.name}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                required
              />
            </div>

            <div>
              <div className="text-xs text-white/60 mb-1">Avatar URL</div>
              <input
                name="avatar_url"
                defaultValue={person.avatar_url ?? ""}
                placeholder="https://..."
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
            </div>
          </div>

          <div>
            <div className="text-xs text-white/60 mb-1">Bio</div>
            <textarea
              name="bio"
              defaultValue={person.bio ?? ""}
              className="min-h-[90px] w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
            />
          </div>

          <div>
            <div className="text-xs text-white/60 mb-1">Kuriosa</div>
            <textarea
              name="fun_facts"
              defaultValue={person.fun_facts ?? ""}
              className="min-h-[90px] w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs text-white/60 mb-1">Styrkor</div>
              <textarea
                name="strengths"
                defaultValue={person.strengths ?? ""}
                className="min-h-[90px] w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
            </div>
            <div>
              <div className="text-xs text-white/60 mb-1">Svagheter</div>
              <textarea
                name="weaknesses"
                defaultValue={person.weaknesses ?? ""}
                className="min-h-[90px] w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
            </div>
          </div>

          <button className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold hover:bg-white/10">
            Spara
          </button>
        </form>
      </section>
    </main>
  );
}