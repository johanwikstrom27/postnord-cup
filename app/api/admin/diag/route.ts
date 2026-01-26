import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hasService: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.length > 20),
  });
}