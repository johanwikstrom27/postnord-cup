export const runtime = "nodejs";

import { supabaseServer } from "@/lib/supabase";
import AdminSeasonBar from "@/components/AdminSeasonBar";

type SeasonRow = { id: string; name: string; created_at: string; is_current: boolean };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sb = supabaseServer();

  const seasonsResp = await sb
    .from("seasons")
    .select("id,name,created_at,is_current")
    .order("created_at", { ascending: false });

  const seasons = (seasonsResp.data as SeasonRow[] | null) ?? [];

  // ✅ Välj nuvarande säsong först
  const current = seasons.find((s) => s.is_current) ?? null;
  const currentSeasonId = current?.id ?? seasons[0]?.id ?? null;

  return (
    <div className="space-y-6">
      <AdminSeasonBar
        seasons={seasons.map((s) => ({ id: s.id, name: s.name }))}
        currentSeasonId={currentSeasonId}
      />
      {children}
    </div>
  );
}