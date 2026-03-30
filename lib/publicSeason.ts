import { supabaseServer } from "@/lib/supabase";

export type PublicSeasonRow = {
  id: string;
  name: string;
  created_at: string;
  is_current?: boolean | null;
  is_published?: boolean | null;
};

export async function resolvePublicSeason(
  sb: ReturnType<typeof supabaseServer>,
  requestedSeasonId: string | null
): Promise<PublicSeasonRow | null> {
  if (requestedSeasonId) {
    const requested = await sb
      .from("seasons")
      .select("id,name,created_at,is_current,is_published")
      .eq("id", requestedSeasonId)
      .eq("is_published", true)
      .single();

    if (requested.data) return requested.data as PublicSeasonRow;
  }

  const current = await sb
    .from("seasons")
    .select("id,name,created_at,is_current,is_published")
    .eq("is_current", true)
    .eq("is_published", true)
    .limit(1)
    .single();

  if (current.data) return current.data as PublicSeasonRow;

  const latest = await sb
    .from("seasons")
    .select("id,name,created_at,is_current,is_published")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return (latest.data as PublicSeasonRow | null) ?? null;
}
