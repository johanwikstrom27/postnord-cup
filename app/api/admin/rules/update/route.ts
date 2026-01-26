import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const form = await req.formData();

  const season_id = String(form.get("season_id") ?? "");
  const vanlig_best_of = Number(form.get("vanlig_best_of") ?? 4);
  const major_best_of = Number(form.get("major_best_of") ?? 3);
  const lagtavling_best_of = Number(form.get("lagtavling_best_of") ?? 2);

  const hcp_zero_max = Number(String(form.get("hcp_zero_max") ?? "10.9").replace(",", "."));
  const hcp_two_max = Number(String(form.get("hcp_two_max") ?? "20.9").replace(",", "."));

  if (!season_id) return NextResponse.redirect(new URL("/admin/rules", req.url));

  await sb.from("season_rules").upsert(
    {
      season_id,
      vanlig_best_of: Number.isNaN(vanlig_best_of) ? 4 : vanlig_best_of,
      major_best_of: Number.isNaN(major_best_of) ? 3 : major_best_of,
      lagtavling_best_of: Number.isNaN(lagtavling_best_of) ? 2 : lagtavling_best_of,
      hcp_zero_max: Number.isNaN(hcp_zero_max) ? 10.9 : hcp_zero_max,
      hcp_two_max: Number.isNaN(hcp_two_max) ? 20.9 : hcp_two_max,
    },
    { onConflict: "season_id" }
  );

  return NextResponse.redirect(new URL(`/admin/rules?season=${encodeURIComponent(season_id)}`, req.url));
}