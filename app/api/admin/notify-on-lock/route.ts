export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: true, msg: "notify-on-lock route is live" });
}