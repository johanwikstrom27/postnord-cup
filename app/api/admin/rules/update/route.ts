import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { normalizeTextarea } from "@/lib/stadgarContent";

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const form = await req.formData();

  const season_id = String(form.get("season_id") ?? "");
  const vanlig_best_of = Number(form.get("vanlig_best_of") ?? 4);
  const major_best_of = Number(form.get("major_best_of") ?? 3);
  const lagtavling_best_of = Number(form.get("lagtavling_best_of") ?? 2);

  const hcp_zero_max = Number(String(form.get("hcp_zero_max") ?? "10.9").replace(",", "."));
  const hcp_two_max = Number(String(form.get("hcp_two_max") ?? "20.9").replace(",", "."));
  const hcp_four_min = Number(String(form.get("hcp_four_min") ?? "15.6").replace(",", "."));

  const stadgar_header_description = normalizeTextarea(form.get("stadgar_header_description"));
  const stadgar_general_title = normalizeTextarea(form.get("stadgar_general_title"));
  const stadgar_general_items = normalizeTextarea(form.get("stadgar_general_items"));
  const stadgar_trackman_title = normalizeTextarea(form.get("stadgar_trackman_title"));
  const stadgar_trackman_items = normalizeTextarea(form.get("stadgar_trackman_items"));
  const stadgar_extra_title = normalizeTextarea(form.get("stadgar_extra_title"));
  const stadgar_extra_body = normalizeTextarea(form.get("stadgar_extra_body"));
  const stadgar_hcp_title = normalizeTextarea(form.get("stadgar_hcp_title"));
  const stadgar_hcp_intro = normalizeTextarea(form.get("stadgar_hcp_intro"));
  const stadgar_final_title = normalizeTextarea(form.get("stadgar_final_title"));
  const stadgar_final_intro = normalizeTextarea(form.get("stadgar_final_intro"));
  const stadgar_points_title = normalizeTextarea(form.get("stadgar_points_title"));
  const stadgar_points_intro = normalizeTextarea(form.get("stadgar_points_intro"));
  const stadgar_regular_points_title = normalizeTextarea(form.get("stadgar_regular_points_title"));
  const stadgar_major_points_title = normalizeTextarea(form.get("stadgar_major_points_title"));
  const stadgar_team_points_title = normalizeTextarea(form.get("stadgar_team_points_title"));
  const stadgar_team_points_note = normalizeTextarea(form.get("stadgar_team_points_note"));

  if (!season_id) return NextResponse.redirect(new URL("/admin/rules", req.url));

  await sb.from("season_rules").upsert(
    {
      season_id,
      vanlig_best_of: Number.isNaN(vanlig_best_of) ? 4 : vanlig_best_of,
      major_best_of: Number.isNaN(major_best_of) ? 3 : major_best_of,
      lagtavling_best_of: Number.isNaN(lagtavling_best_of) ? 2 : lagtavling_best_of,
      hcp_zero_max: Number.isNaN(hcp_zero_max) ? 10.9 : hcp_zero_max,
      hcp_two_max: Number.isNaN(hcp_two_max) ? 20.9 : hcp_two_max,
      hcp_four_min: Number.isNaN(hcp_four_min) ? 15.6 : hcp_four_min,
      stadgar_header_description,
      stadgar_general_title,
      stadgar_general_items,
      stadgar_trackman_title,
      stadgar_trackman_items,
      stadgar_extra_title,
      stadgar_extra_body,
      stadgar_hcp_title,
      stadgar_hcp_intro,
      stadgar_final_title,
      stadgar_final_intro,
      stadgar_points_title,
      stadgar_points_intro,
      stadgar_regular_points_title,
      stadgar_major_points_title,
      stadgar_team_points_title,
      stadgar_team_points_note,
    },
    { onConflict: "season_id" }
  );

  return NextResponse.redirect(new URL(`/admin/rules?season=${encodeURIComponent(season_id)}`, req.url));
}
