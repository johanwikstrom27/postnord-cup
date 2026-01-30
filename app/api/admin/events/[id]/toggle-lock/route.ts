import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { notifyOnEventLocked } from "@/lib/notifyOnLock";

export const runtime = "nodejs";

export async function POST(_: Request, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const { id: eventId } = await ctx.params;
  const sb = supabaseServer();

  const ev1 = await sb.from("events").select("id, locked").eq("id", eventId).single();
  if (ev1.error) return NextResponse.json({ error: ev1.error.message }, { status: 500 });
  if (!ev1.data) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const before = Boolean(ev1.data.locked);
  const afterWanted = !before;

  const up = await sb.from("events").update({ locked: afterWanted }).eq("id", eventId);
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

  const ev2 = await sb.from("events").select("id, locked").eq("id", eventId).single();
  if (ev2.error) return NextResponse.json({ error: ev2.error.message }, { status: 500 });

  const after = Boolean(ev2.data?.locked);

  // ✅ If just locked: trigger notifications (works in preview too)
  if (afterWanted === true && after === true) {
    try {
      await notifyOnEventLocked(eventId);
    } catch {
      // ignore
    }
  }

  return NextResponse.json({ ok: true, before, after });
}