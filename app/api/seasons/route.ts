export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

type SeasonRow = {
  id: string;
  name: string;
  is_current: boolean | null;
  is_published: boolean | null;
  created_at: string;
};

export async function GET() {
  const sb = supabaseServer();

  const resp = await sb
    .from("seasons")
    .select("id,name,is_current,is_published,created_at")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (resp.error) {
    return NextResponse.json({ error: resp.error.message }, { status: 500 });
  }

  const seasons = (resp.data ?? []) as SeasonRow[];
  return NextResponse.json({ seasons });
}
