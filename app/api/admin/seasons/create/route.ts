import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

function seasonNameFromStartYear(startYear: number) {
  return `PostNord Cup ${startYear}/${startYear + 1}`;
}

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const form = await req.formData();

  const startYearRaw = String(form.get("start_year") ?? "").trim();
  const startYear = Number(startYearRaw);
  if (Number.isNaN(startYear) || startYear < 2000 || startYear > 2100) {
    return NextResponse.redirect(new URL("/admin/seasons", req.url));
  }

  const name = seasonNameFromStartYear(startYear);

  const copy_from = String(form.get("copy_from") ?? "").trim() || null;
  const copy_rules = form.get("copy_rules") === "on";
  const copy_points = form.get("copy_points") === "on";
  const copy_players = form.get("copy_players") === "on";

  // 1) skapa säsong
  const insSeason = await sb.from("seasons").insert({ name }).select("id").single();
  const newSeasonId = insSeason.data?.id as string | undefined;

  if (!newSeasonId) return NextResponse.redirect(new URL("/admin/seasons", req.url));

  // 2) kopiera eller skapa default regler
  if (copy_from) {
    if (copy_rules) {
      const rules = await sb
        .from("season_rules")
        .select("*")
        .eq("season_id", copy_from)
        .single();

      if (rules.data) {
        const { season_id, id, ...rest } = rules.data as any;
        await sb.from("season_rules").insert({ season_id: newSeasonId, ...rest });
      }
    } else {
      await sb.from("season_rules").insert({
        season_id: newSeasonId,
        vanlig_best_of: 4,
        major_best_of: 3,
        lagtavling_best_of: 2,
      });
    }

    if (copy_points) {
      const pts = await sb.from("points_table").select("*").eq("season_id", copy_from);
      const rows = (pts.data ?? []) as any[];

      if (rows.length) {
        const newRows = rows.map((r) => {
          const { season_id, id, ...rest } = r;
          return { season_id: newSeasonId, ...rest };
        });
        await sb.from("points_table").insert(newRows);
      }
    }

    if (copy_players) {
      const sps = await sb.from("season_players").select("person_id,hcp").eq("season_id", copy_from);
      const rows = (sps.data ?? []) as any[];

      if (rows.length) {
        const newRows = rows.map((r) => ({
          season_id: newSeasonId,
          person_id: r.person_id,
          hcp: r.hcp,
        }));
        await sb.from("season_players").insert(newRows);
      }
    }
  } else {
    // ingen mall => default rules
    await sb.from("season_rules").insert({
      season_id: newSeasonId,
      vanlig_best_of: 4,
      major_best_of: 3,
      lagtavling_best_of: 2,
    });
  }

  return NextResponse.redirect(new URL(`/admin?season=${encodeURIComponent(newSeasonId)}`, req.url));
}