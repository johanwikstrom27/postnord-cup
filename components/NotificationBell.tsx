"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Prefs = { notify_results: boolean; notify_leader: boolean };

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function NotificationBell() {
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [endpoint, setEndpoint] = useState<string>("");

  const [prefs, setPrefs] = useState<Prefs>({ notify_results: true, notify_leader: true });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);

  const dotOn = useMemo(() => enabled && (prefs.notify_results || prefs.notify_leader), [enabled, prefs]);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
  }, []);

  // close on click outside
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node;
      if (dropRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      setOpen(false);
    }
    window.addEventListener("mousedown", onDown, true);
    return () => window.removeEventListener("mousedown", onDown, true);
  }, [open]);

  // load current subscription + prefs
  useEffect(() => {
    if (!supported) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        if (!sub) {
          setEnabled(false);
          return;
        }
        setEnabled(Notification.permission === "granted");
        setEndpoint(sub.endpoint);

        const res = await fetch(`/api/push/status?endpoint=${encodeURIComponent(sub.endpoint)}`);
        const j = await res.json();
        if (j?.subscribed) {
          setPrefs({ notify_results: !!j.notify_results, notify_leader: !!j.notify_leader });
        }
      } catch {
        // ignore
      }
    })();
  }, [supported]);

  async function enablePush() {
    setBusy(true);
    setMsg(null);
    try {
      if (!vapid) throw new Error("Saknar NEXT_PUBLIC_VAPID_PUBLIC_KEY");

      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("Notiser nekades");

      const reg = await navigator.serviceWorker.register("/sw.js");

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });

      const json = sub.toJSON() as any;
      const p256dh = json?.keys?.p256dh;
      const auth = json?.keys?.auth;

      const r = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh,
          auth,
          notify_results: prefs.notify_results,
          notify_leader: prefs.notify_leader,
        }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? "Kunde inte spara subscription");

      setEnabled(true);
      setEndpoint(sub.endpoint);
      setMsg("✅ Notiser aktiverade!");
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? "Fel"}`);
    } finally {
      setBusy(false);
    }
  }

  async function savePrefs() {
    setBusy(true);
    setMsg(null);
    try {
      if (!endpoint) throw new Error("Ingen subscription hittades");

      const r = await fetch("/api/push/prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint, ...prefs }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? "Kunde inte spara");

      setMsg("✅ Inställningar sparade!");
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? "Fel"}`);
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setEnabled(false);
      setEndpoint("");
      setMsg("✅ Notiser avstängda");
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? "Fel"}`);
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition"
        title="Notiser"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/bell-icon.png" alt="Notiser" className="h-5 w-5 object-contain" />
        {dotOn ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-400" /> : null}
      </button>

      {open ? (
        <div
          ref={dropRef}
          className={[
            // ✅ CENTERED under icon
            "absolute left-1/2 top-full mt-2 -translate-x-1/2",
            // style
            "w-[340px] rounded-2xl border border-white/10 bg-[#0b1220] shadow-2xl p-4 z-50",
            // tiny motion feel
            "origin-top",
          ].join(" ")}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">Notiser</div>
              <div className="text-sm text-white/60">{enabled ? "Aktiva" : "Avstängda"}</div>
            </div>

            {!enabled ? (
              <button
                onClick={enablePush}
                disabled={busy}
                className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15 disabled:opacity-50"
              >
                Aktivera
              </button>
            ) : (
              <button
                onClick={disablePush}
                disabled={busy}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
              >
                Stäng av
              </button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            <label className="flex items-center justify-between gap-3">
              <span className="text-base">🥇 Resultat publicerat</span>
              <input
                type="checkbox"
                checked={prefs.notify_results}
                onChange={(e) => setPrefs((p) => ({ ...p, notify_results: e.target.checked }))}
              />
            </label>

            <label className="flex items-center justify-between gap-3">
              <span className="text-base">🚨 Ny serieledare</span>
              <input
                type="checkbox"
                checked={prefs.notify_leader}
                onChange={(e) => setPrefs((p) => ({ ...p, notify_leader: e.target.checked }))}
              />
            </label>

            <button
              onClick={savePrefs}
              disabled={!enabled || busy}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/15 disabled:opacity-50"
            >
              Spara inställningar
            </button>

            {msg ? <div className="text-xs text-white/70">{msg}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}