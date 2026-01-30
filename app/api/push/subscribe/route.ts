export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: Request) {
  const sb = supabaseServer();
  const body = await req.json().catch(() => ({}));

  const endpoint = String(body?.endpoint ?? "");
  const p256dh = String(body?.p256dh ?? "");
  const auth = String(body?.auth ?? "");

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Missing subscription fields" }, { status: 400 });
  }

  const notify_results = body?.notify_results ?? true;
  const notify_leader = body?.notify_leader ?? true;

  const { error } = await sb.from("push_subscriptions").upsert(
    {
      endpoint,
      p256dh,
      auth,
      notify_results: Boolean(notify_results),
      notify_leader: Boolean(notify_leader),
    },
    { onConflict: "endpoint" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}