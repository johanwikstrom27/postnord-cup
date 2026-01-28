import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

async function isAdmin() {
  const cookieName = process.env.ADMIN_COOKIE_NAME || "pn_admin";
  const c = await cookies();
  const v = c.get(cookieName)?.value;
  return v === "1";
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseServer();
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  const copyFromCurrent = Boolean(body?.copyFromCurrent ?? true);

  if (!name) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  // Skapa ny säsong som INAKTIV
  const insSeason = await sb
    .from("seasons")
    .insert({ name, is_current: false })
    .select("id")
    .single();

  if (insSeason.error) {
    return NextResponse.json({ error: insSeason.error.message }, { status: 500 });
  }

  const newSeasonId = insSeason.data.id as string;

  if (copyFromCurrent) {
    // Hitta nuvarande säsong (fallback senaste)
    const cur = await sb
      .from("seasons")
      .select("id")
      .eq("is_current", true)
      .limit(1)
      .single();

    let sourceSeasonId = (cur.data?.id as string | undefined) ?? null;

    if (!sourceSeasonId) {
      const latest = await sb
        .from("seasons")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      sourceSeasonId = (latest.data?.id as string | undefined) ?? null;
    }

    if (sourceSeasonId) {
      // Kopiera season_rules
      const sr = await sb
        .from("season_rules")
        .select("*")
        .eq("season_id", sourceSeasonId)
        .single();

      if (sr.data) {
        const { season_id, id, created_at, ...rest } = sr.data as any;
        await sb.from("season_rules").insert({ season_id: newSeasonId, ...rest });
      }

      // Kopiera points_table
      const pt = await sb
        .from("points_table")
        .select("*")
        .eq("season_id", sourceSeasonId)
        .order("event_type", { ascending: true })
        .order("placing", { ascending: true });

      if (pt.data?.length) {
        const rows = (pt.data as any[]).map((r) => {
          const { season_id, id, created_at, ...rest } = r;
          return { season_id: newSeasonId, ...rest };
        });
        await sb.from("points_table").insert(rows);
      }
    }
  }

  return NextResponse.json({ ok: true, season_id: newSeasonId });
}