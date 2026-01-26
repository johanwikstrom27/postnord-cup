export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Suspense } from "react";
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
      {/* ✅ Viktigt: useSearchParams() i AdminSeasonBar kräver Suspense */}
      <Suspense fallback={<div className="h-[84px] rounded-2xl border border-white/10 bg-white/5" />}>
        <AdminSeasonBar
          seasons={seasons.map((s) => ({ id: s.id, name: s.name }))}
          currentSeasonId={currentSeasonId}
        />
      </Suspense>

      {children}
    </div>
  );
}