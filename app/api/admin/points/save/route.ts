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
  if (!season_id) {
    return NextResponse.json({ error: "Missing season_id" }, { status: 400 });
  }

  // 1) Final startscore array sparas i season_rules
  const r1 = num(form.get("final_r1"), -10);
  const r2 = num(form.get("final_r2"), -8);
  const r3 = num(form.get("final_r3"), -6);
  const r4 = num(form.get("final_r4"), -5);
  const r5 = num(form.get("final_r5"), -4);
  const r6 = num(form.get("final_r6"), -3);
  const r7 = num(form.get("final_r7"), -2);
  const r8 = num(form.get("final_r8"), -1);
  const r9 = num(form.get("final_r9plus"), 0);

  const final_start_scores = [r1, r2, r3, r4, r5, r6, r7, r8, r9];

  const upRules = await sb
    .from("season_rules")
    .upsert({ season_id, final_start_scores }, { onConflict: "season_id" });

  if (upRules.error) {
    return NextResponse.json({ error: upRules.error.message }, { status: 500 });
  }

  // 2) points_table (OBS: kräver season_id!)
  const rows: Array<{ season_id: string; event_type: string; placering: number; poang: number }> = [];

  for (let i = 1; i <= 12; i++) {
    rows.push({ season_id, event_type: "VANLIG", placering: i, poang: num(form.get(`points_VANLIG_${i}`), 0) });
    rows.push({ season_id, event_type: "MAJOR", placering: i, poang: num(form.get(`points_MAJOR_${i}`), 0) });
    rows.push({ season_id, event_type: "FINAL", placering: i, poang: num(form.get(`points_FINAL_${i}`), 0) });
  }

  for (let i = 1; i <= 6; i++) {
    rows.push({ season_id, event_type: "LAGTÄVLING", placering: i, poang: num(form.get(`points_LAGTÄVLING_${i}`), 0) });
  }

  const upPts = await sb
    .from("points_table")
    .upsert(rows, { onConflict: "season_id,event_type,placering" });

  if (upPts.error) {
    return NextResponse.json({ error: upPts.error.message }, { status: 500 });
  }

  return NextResponse.redirect(new URL(`/admin/points?season=${encodeURIComponent(season_id)}`, req.url));
}