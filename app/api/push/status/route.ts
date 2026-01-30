export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function GET(req: Request) {
  const sb = supabaseServer();
  const url = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint") || "";

  if (!endpoint) {
    return NextResponse.json({ ok: true, subscribed: false, notify_results: true, notify_leader: true });
  }

  const { data, error } = await sb
    .from("push_subscriptions")
    .select("endpoint,notify_results,notify_leader")
    .eq("endpoint", endpoint)
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: true, subscribed: false, notify_results: true, notify_leader: true });
  }

  return NextResponse.json({
    ok: true,
    subscribed: true,
    notify_results: Boolean((data as any).notify_results),
    notify_leader: Boolean((data as any).notify_leader),
  });
}