export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { sendToSubscribers } from "@/lib/push";

export async function GET() {
  await sendToSubscribers("results", {
    title: "🧪 Testnotis – PostNord Cup",
    body: "Om du ser detta fungerar push från servern ✅",
    url: "/",
  });
  return NextResponse.json({ ok: true });
}