export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: Request) {
  const sb = supabaseServer();
  const body = await req.json().catch(() => ({}));

  const endpoint = String(body?.endpoint ?? "");
  if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });

  const notify_results = Boolean(body?.notify_results);
  const notify_leader = Boolean(body?.notify_leader);

  const { error } = await sb
    .from("push_subscriptions")
    .update({ notify_results, notify_leader })
    .eq("endpoint", endpoint);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}