import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

function num(v: FormDataEntryValue | null, fallback: number) {
  const s = String(v ?? "").trim().replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const form = await req.formData();

  const season_id = String(form.get("season_id") ?? "");
  if (!season_id) return NextResponse.redirect(new URL("/admin/rules", req.url));

  const vanlig_best_of = Math.max(0, Math.floor(num(form.get("vanlig_best_of"), 4)));
  const major_best_of = Math.max(0, Math.floor(num(form.get("major_best_of"), 3)));
  const lagtavling_best_of = Math.max(0, Math.floor(num(form.get("lagtavling_best_of"), 2)));

  const hcp_zero_max = num(form.get("hcp_zero_max"), 10.5);
  const hcp_two_max = num(form.get("hcp_two_max"), 15.5);
  const hcp_four_min = num(form.get("hcp_four_min"), 15.6);

  await sb.from("season_rules").upsert(
    {
      season_id,
      vanlig_best_of,
      major_best_of,
      lagtavling_best_of,
      hcp_zero_max,
      hcp_two_max,
      hcp_four_min,
    },
    { onConflict: "season_id" }
  );

  return NextResponse.redirect(new URL(`/admin/rules?season=${encodeURIComponent(season_id)}`, req.url));
}