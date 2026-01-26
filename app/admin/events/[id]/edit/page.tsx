export const runtime = "nodejs";

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase";

type EventRow = {
  id: string;
  season_id: string;
  name: string;
  event_type: string;
  starts_at: string;
  course: string | null;
  description: string | null;
  image_url: string | null;
  setting_wind: string | null;
  setting_tee_meters: number | null;
  setting_pins: string | null;
  locked: boolean;
};

function toLocalInput(iso: string) {
  // ISO -> "YYYY-MM-DDTHH:MM" (för <input type="datetime-local">)
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = supabaseServer();

  const eventResp = await sb
    .from("events")
    .select("id,season_id,name,event_type,starts_at,course,description,image_url,setting_wind,setting_tee_meters,setting_pins,locked")
    .eq("id", id)
    .single();

  const event = (eventResp.data as EventRow | null) ?? null;

  if (!event) {
    return (
      <main className="space-y-4">
        <Link href="/admin/events" className="text-sm text-white/70 hover:underline">
          ← Till tävlingar
        </Link>
        <div className="text-white/70">Tävlingen hittades inte.</div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/admin/events" className="text-sm text-white/70 hover:underline">
          ← Till tävlingar
        </Link>
        <Link href={`/events/${event.id}`} className="text-sm text-white/70 hover:underline">
          Öppna publika sidan →
        </Link>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm text-white/60">Redigera tävling</div>
        <h1 className="text-2xl font-semibold">{event.name}</h1>
        <div className="mt-1 text-sm text-white/60">ID: {event.id}</div>

        <form className="mt-6 space-y-6" method="POST" action="/api/admin/events/update">
          <input type="hidden" name="event_id" value={event.id} />

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs text-white/60 mb-1">Namn</div>
              <input
                name="name"
                defaultValue={event.name}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                required
              />
            </div>

            <div>
              <div className="text-xs text-white/60 mb-1">Typ</div>
              <select
                name="event_type"
                defaultValue={event.event_type}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              >
                <option value="VANLIG">Vanlig</option>
                <option value="MAJOR">Major</option>
                <option value="LAGTÄVLING">Lagtävling</option>
                <option value="FINAL">Final</option>
              </select>
            </div>

            <div>
              <div className="text-xs text-white/60 mb-1">Datum & tid</div>
              <input
                type="datetime-local"
                name="starts_at_local"
                defaultValue={toLocalInput(event.starts_at)}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                required
              />
              <div className="mt-1 text-xs text-white/50">Sparas i UTC i databasen.</div>
            </div>

            <div>
              <div className="text-xs text-white/60 mb-1">Bana</div>
              <input
                name="course"
                defaultValue={event.course ?? ""}
                placeholder="ex: Casa de Campo"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
            </div>
          </div>

          <div>
            <div className="text-xs text-white/60 mb-1">Bild-URL</div>
            <input
              name="image_url"
              defaultValue={event.image_url ?? ""}
              placeholder="https://..."
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-xs text-white/60 mb-1">Vind</div>
              <input
                name="setting_wind"
                defaultValue={event.setting_wind ?? ""}
                placeholder="Breezy / Windy"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
            </div>

            <div>
              <div className="text-xs text-white/60 mb-1">Tee (meter)</div>
              <input
                type="number"
                name="setting_tee_meters"
                defaultValue={event.setting_tee_meters ?? ""}
                placeholder="5800"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
            </div>

            <div>
              <div className="text-xs text-white/60 mb-1">Pins</div>
              <input
                name="setting_pins"
                defaultValue={event.setting_pins ?? ""}
                placeholder="Easy / Medium / Hard"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              />
            </div>
          </div>

          <div>
            <div className="text-xs text-white/60 mb-1">Beskrivning</div>
            <textarea
              name="description"
              defaultValue={event.description ?? ""}
              placeholder="Kort beskrivning av tävlingen..."
              className="min-h-[120px] w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input type="checkbox" name="locked" defaultChecked={event.locked} />
              Låst (officiell)
            </label>
            <span className="text-xs text-white/50">
              (Du kan låsa/låsa upp här också, men normalt görs det i resultatvyn.)
            </span>
          </div>

          <div className="flex gap-3">
            <button className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold hover:bg-white/10">
              Spara ändringar
            </button>
            <Link
              href="/admin/events"
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold hover:bg-white/10"
            >
              Avbryt
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}