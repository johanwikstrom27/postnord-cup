import { supabaseServer } from "@/lib/supabase";

const ALL_ROWS_SENTINEL_ID = "00000000-0000-0000-0000-000000000000";

function isMissingColumnError(err: { message?: string } | null) {
  const msg = String(err?.message ?? "").toLowerCase();
  return msg.includes("notifications_paused") && msg.includes("column");
}

export async function areNotificationsPaused(sb: ReturnType<typeof supabaseServer>): Promise<boolean> {
  const resp = await sb
    .from("seasons")
    .select("id")
    .eq("notifications_paused", true)
    .limit(1);

  if (resp.error) {
    // Before migration is applied, keep legacy behavior (notifications on).
    if (isMissingColumnError(resp.error)) return false;

    // Fail-safe: if we cannot verify, treat as paused to avoid accidental notification blasts.
    return true;
  }

  return (resp.data ?? []).length > 0;
}

export async function setNotificationsPaused(
  sb: ReturnType<typeof supabaseServer>,
  paused: boolean
): Promise<{ ok: true } | { ok: false; error: string; missingColumn: boolean }> {
  const upd = await sb
    .from("seasons")
    .update({ notifications_paused: paused })
    .neq("id", ALL_ROWS_SENTINEL_ID);

  if (!upd.error) return { ok: true };

  return {
    ok: false,
    error: upd.error.message,
    missingColumn: isMissingColumnError(upd.error),
  };
}
