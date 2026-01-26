import { createClient } from "@supabase/supabase-js";

export function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const key = service && service.length > 20 ? service : anon;

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}