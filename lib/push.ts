import * as webpush from "web-push";
import { supabaseServer } from "@/lib/supabase";

type PushType = "results" | "leader";

type Payload = {
  title: string;
  body: string;
  url?: string;
};

type SubRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
  notify_results: boolean;
  notify_leader: boolean;
};

function ensureEnv() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub) throw new Error("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  if (!priv) throw new Error("Missing VAPID_PRIVATE_KEY");
  return { pub, priv };
}

function setupWebPush() {
  const { pub, priv } = ensureEnv();
  webpush.setVapidDetails("mailto:admin@postnord-cup.se", pub, priv);
}

export async function sendToSubscribers(type: PushType, payload: Payload) {
  setupWebPush();
  const sb = supabaseServer();

  const col = type === "results" ? "notify_results" : "notify_leader";

  const { data, error } = await sb
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth,notify_results,notify_leader")
    .eq(col, true);

  if (error) throw new Error(error.message);

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
  });

  await Promise.all(
    (data as SubRow[]).map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        );
      } catch {
        // ignore dead endpoints
      }
    })
  );
}